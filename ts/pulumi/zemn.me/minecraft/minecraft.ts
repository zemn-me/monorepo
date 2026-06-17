import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';

import {
	sanitizeAwsAlphaNumericHyphenUnderscoreName,
	sanitizeAwsEcsTaskFamilyName,
	sanitizeAwsLambdaFunctionName,
	sanitizeAwsLambdaStatementId,
} from '#root/ts/pulumi/lib/awsNames.js';
import { mergeTags, TagSet, tagTrue } from '#root/ts/pulumi/lib/tags.js';

export type MinecraftEnvironmentName = 'production' | 'staging';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	environmentName: MinecraftEnvironmentName;
	manageDnsWake?: boolean;
	operators?: Pulumi.Input<Pulumi.Input<string>[]>;
	tags?: TagSet;
}

const minecraftPort = 25565;
const minecraftRconPort = 25575;
const minecraftServerImage = 'itzg/minecraft-server:latest';

function wakeLambdaCode(): string {
	return `
const zlib = require("node:zlib");
const { ECSClient, DescribeTasksCommand, UpdateServiceCommand } = require("@aws-sdk/client-ecs");
const { EC2Client, DescribeNetworkInterfacesCommand } = require("@aws-sdk/client-ec2");
const { Route53Client, ChangeResourceRecordSetsCommand } = require("@aws-sdk/client-route-53");

const ecs = new ECSClient({});
const ec2 = new EC2Client({});
const route53 = new Route53Client({});
const cluster = process.env.ECS_CLUSTER_NAME;
const service = process.env.ECS_SERVICE_NAME;
const publicDnsHostedZoneId = normalizeHostedZoneId(process.env.PUBLIC_DNS_HOSTED_ZONE_ID || "");
const publicDnsRecordNames = parseCsv(process.env.PUBLIC_DNS_RECORD_NAMES || "");
const publicDnsStoppedAddress = process.env.PUBLIC_DNS_STOPPED_ADDRESS || "192.0.2.1";
const privateDnsHostedZoneId = normalizeHostedZoneId(process.env.PRIVATE_DNS_HOSTED_ZONE_ID || "");
const privateDnsRecordNames = parseCsv(process.env.PRIVATE_DNS_RECORD_NAMES || "");
const privateDnsStoppedAddress = process.env.PRIVATE_DNS_STOPPED_ADDRESS || "10.42.0.254";
const wakeNames = (process.env.WAKE_NAMES || "")
	.split(",")
	.map(v => v.trim().toLowerCase())
	.filter(Boolean);

function parseCsv(value) {
	return value
		.split(",")
		.map(v => v.trim())
		.filter(Boolean);
}

function normalizeHostedZoneId(value) {
	return value.replace(/^\\/hostedzone\\//, "");
}

async function scale(desiredCount, reason) {
	console.log(JSON.stringify({ desiredCount, reason }));
	await ecs.send(new UpdateServiceCommand({
		cluster,
		service,
		desiredCount,
	}));
}

function logMessages(event) {
	if (!event.awslogs?.data) return [];

	const payload = JSON.parse(
		zlib.gunzipSync(Buffer.from(event.awslogs.data, "base64")).toString("utf8")
	);

	return payload.logEvents?.map(logEvent => logEvent.message ?? "") ?? [];
}

function networkInterfaceIdFromAttachments(attachments) {
	for (const attachment of attachments || []) {
		for (const detail of attachment.details || []) {
			if (detail.name === "networkInterfaceId") {
				return detail.value;
			}
		}
	}
	return undefined;
}

async function describeTaskNetworkInterfaceId(detail) {
	if (!detail.taskArn) return undefined;
	const response = await ecs.send(new DescribeTasksCommand({
		cluster,
		tasks: [detail.taskArn],
	}));
	return networkInterfaceIdFromAttachments(response.tasks?.[0]?.attachments);
}

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function taskAddresses(detail) {
	const networkInterfaceId =
		networkInterfaceIdFromAttachments(detail.attachments) ||
		(await describeTaskNetworkInterfaceId(detail));

	if (!networkInterfaceId) {
		throw new Error("minecraft task network interface was not found");
	}

	let lastNetworkInterface;
	for (let attempt = 0; attempt < 12; attempt += 1) {
		const response = await ec2.send(new DescribeNetworkInterfacesCommand({
			NetworkInterfaceIds: [networkInterfaceId],
		}));
		lastNetworkInterface = response.NetworkInterfaces?.[0];
		if (
			lastNetworkInterface?.PrivateIpAddress &&
			lastNetworkInterface?.Association?.PublicIp
		) {
			return {
				privateIp: lastNetworkInterface.PrivateIpAddress,
				publicIp: lastNetworkInterface.Association.PublicIp,
			};
		}
		await delay(1000);
	}

	if (!lastNetworkInterface?.PrivateIpAddress) {
		throw new Error("minecraft task private IP was not found");
	}
	if (!lastNetworkInterface?.Association?.PublicIp) {
		throw new Error("minecraft task public IP was not found");
	}

	return {
		privateIp: lastNetworkInterface.PrivateIpAddress,
		publicIp: lastNetworkInterface.Association.PublicIp,
	};
}

async function updateDnsRecords(hostedZoneId, recordNames, address, reason) {
	if (!hostedZoneId || recordNames.length === 0) return;

	console.log(JSON.stringify({
		address,
		hostedZoneId,
		reason,
		recordNames,
	}));

	await route53.send(new ChangeResourceRecordSetsCommand({
		HostedZoneId: hostedZoneId,
		ChangeBatch: {
			Comment: reason,
			Changes: recordNames.map(name => ({
				Action: "UPSERT",
				ResourceRecordSet: {
					Name: name,
					Type: "A",
					TTL: 30,
					ResourceRecords: [{ Value: address }],
				},
			})),
		},
	}));
}

exports.handler = async event => {
	if (event?.action === "wake") {
		await scale(1, event.reason || "minecraft api wake");
		return { wakeRequested: true };
	}

	if (event.source === "aws.ecs" && event["detail-type"] === "ECS Task State Change") {
		if (event.detail?.lastStatus === "RUNNING") {
			const addresses = await taskAddresses(event.detail);
			await updateDnsRecords(
				publicDnsHostedZoneId,
				publicDnsRecordNames,
				addresses.publicIp,
				"minecraft task running"
			);
			await updateDnsRecords(
				privateDnsHostedZoneId,
				privateDnsRecordNames,
				addresses.privateIp,
				"minecraft task running"
			);
		}
		if (event.detail?.lastStatus === "STOPPED") {
			await scale(0, "minecraft task stopped");
			await updateDnsRecords(
				publicDnsHostedZoneId,
				publicDnsRecordNames,
				publicDnsStoppedAddress,
				"minecraft task stopped"
			);
			await updateDnsRecords(
				privateDnsHostedZoneId,
				privateDnsRecordNames,
				privateDnsStoppedAddress,
				"minecraft task stopped"
			);
		}
		return;
	}

	const matched = logMessages(event).some(message => {
		const lower = message.toLowerCase();
		return wakeNames.some(name => lower.includes(name));
	});

	if (matched) {
		await scale(1, "minecraft dns query");
	}
};
`;
}

function rconBridgeLambdaCode(): string {
	return `
const net = require("node:net");

const host = process.env.RCON_HOST;
const port = Number(process.env.RCON_PORT || "25575");
const password = process.env.RCON_PASSWORD;
const timeoutMs = 5000;
const usernamePattern = "[A-Za-z0-9_]{3,16}";
const commandPattern = new RegExp("^(list|whitelist (add|remove) " + usernamePattern + ")$");

function packet(id, type, body) {
	const bodyBuffer = Buffer.from(body, "utf8");
	const length = 4 + 4 + bodyBuffer.length + 2;
	const buffer = Buffer.alloc(4 + length);
	buffer.writeInt32LE(length, 0);
	buffer.writeInt32LE(id, 4);
	buffer.writeInt32LE(type, 8);
	bodyBuffer.copy(buffer, 12);
	return buffer;
}

function readPacket(socket) {
	let buffer = Buffer.alloc(0);
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error("minecraft rcon read timed out"));
		}, timeoutMs);

		function cleanup() {
			clearTimeout(timer);
			socket.off("data", onData);
			socket.off("error", onError);
			socket.off("close", onClose);
		}

		function onError(error) {
			cleanup();
			reject(error);
		}

		function onClose() {
			cleanup();
			reject(new Error("minecraft rcon socket closed"));
		}

		function onData(chunk) {
			buffer = Buffer.concat([buffer, chunk]);
			if (buffer.length < 4) return;
			const length = buffer.readInt32LE(0);
			if (length < 10 || length > 4096) {
				cleanup();
				reject(new Error("invalid minecraft rcon packet size " + length));
				return;
			}
			if (buffer.length < 4 + length) return;
			const payload = buffer.subarray(4, 4 + length);
			cleanup();
			resolve({
				id: payload.readInt32LE(0),
				type: payload.readInt32LE(4),
				body: payload.subarray(8, payload.length - 2).toString("utf8"),
			});
		}

		socket.on("data", onData);
		socket.once("error", onError);
		socket.once("close", onClose);
	});
}

function connect() {
	return new Promise((resolve, reject) => {
		const socket = net.connect({ host, port });
		const timer = setTimeout(() => {
			socket.destroy();
			reject(new Error("minecraft rcon connect timed out"));
		}, timeoutMs);
		socket.once("connect", () => {
			clearTimeout(timer);
			resolve(socket);
		});
		socket.once("error", error => {
			clearTimeout(timer);
			reject(error);
		});
	});
}

exports.handler = async event => {
	const command = String(event.command || "");
	if (!commandPattern.test(command)) {
		throw new Error("minecraft rcon command is not allowed");
	}
	if (!host || !password) {
		throw new Error("minecraft rcon bridge is not configured");
	}

	const socket = await connect();
	try {
		socket.write(packet(1, 3, password));
		const auth = await readPacket(socket);
		if (auth.id === -1) {
			throw new Error("minecraft rcon authentication failed");
		}

		socket.write(packet(2, 2, command));
		const response = await readPacket(socket);
		return { response: response.body };
	} finally {
		socket.end();
	}
};
`;
}

export class MinecraftOnDemand extends Pulumi.ComponentResource {
	public readonly rconBridgeFunctionArn: Pulumi.Output<string>;
	public readonly rconBridgeFunctionName: Pulumi.Output<string>;
	public readonly taskLogGroupArn: Pulumi.Output<string>;
	public readonly taskLogGroupName: Pulumi.Output<string>;
	public readonly wakeFunctionArn: Pulumi.Output<string>;
	public readonly wakeFunctionName: Pulumi.Output<string>;

	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:zemn.me:MinecraftOnDemand', name, args, opts);

		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));
		const publicDomain = ['minecraft', args.domain].join('.');
		const srvPlayerDomains = [args.domain, publicDomain];
		const serverDomain = ['server', publicDomain].join('.');
		const wakeNames = [publicDomain, `${publicDomain}.`];
		const alphaNumericPhysicalNamePrefix =
			sanitizeAwsAlphaNumericHyphenUnderscoreName(
				`zemn_me_minecraft_${args.environmentName}`
			);
		const resourceName = (suffix: string) => `${name}_${suffix}`;
		const hostedZoneArn = (zoneId: string) =>
			`arn:aws:route53:::hostedzone/${zoneId.replace(/^\/hostedzone\//, '')}`;
		const manageDnsWake = args.manageDnsWake ?? true;
		const minecraftZone = manageDnsWake
			? new aws.route53.Zone(
					resourceName('zone'),
					{
						name: publicDomain,
						tags,
					},
					{ parent: this }
				)
			: undefined;
		const minecraftZoneId = minecraftZone?.id ?? args.zoneId;

		if (minecraftZone) {
			new aws.route53.Record(
				resourceName('zone_delegation'),
				{
					zoneId: args.zoneId,
					name: publicDomain,
					type: 'NS',
					ttl: 300,
					records: minecraftZone.nameServers,
				},
				{ parent: this }
			);
		}

		const vpc = new aws.ec2.Vpc(
			resourceName('vpc'),
			{
				cidrBlock: '10.42.0.0/16',
				enableDnsHostnames: true,
				enableDnsSupport: true,
				tags,
			},
			{ parent: this }
		);

		const internetGateway = new aws.ec2.InternetGateway(
			resourceName('igw'),
			{
				vpcId: vpc.id,
				tags,
			},
			{ parent: this }
		);

		const subnet = new aws.ec2.Subnet(
			resourceName('public_subnet'),
			{
				cidrBlock: '10.42.0.0/24',
				mapPublicIpOnLaunch: true,
				vpcId: vpc.id,
				tags,
			},
			{ parent: this }
		);

		const routeTable = new aws.ec2.RouteTable(
			resourceName('public_route_table'),
			{
				routes: [
					{
						cidrBlock: '0.0.0.0/0',
						gatewayId: internetGateway.id,
					},
				],
				vpcId: vpc.id,
				tags,
			},
			{ parent: this }
		);

		new aws.ec2.RouteTableAssociation(
			resourceName('public_route_table_association'),
			{
				routeTableId: routeTable.id,
				subnetId: subnet.id,
			},
			{ parent: this }
		);

		const rconBridgeSecurityGroup = new aws.ec2.SecurityGroup(
			resourceName('rcon_bridge_sg'),
			{
				description: 'Minecraft RCON bridge Lambda egress',
				vpcId: vpc.id,
				egress: [],
				tags,
			},
			{ parent: this }
		);

		new aws.ec2.SecurityGroupRule(
			resourceName('rcon_bridge_egress'),
			{
				type: 'egress',
				securityGroupId: rconBridgeSecurityGroup.id,
				protocol: 'tcp',
				fromPort: minecraftRconPort,
				toPort: minecraftRconPort,
				cidrBlocks: ['10.42.0.0/16'],
			},
			{ parent: this }
		);

		const taskSecurityGroup = new aws.ec2.SecurityGroup(
			resourceName('task_sg'),
			{
				description: 'Minecraft ECS task ingress',
				vpcId: vpc.id,
				ingress: [
					{
						protocol: 'tcp',
						fromPort: minecraftPort,
						toPort: minecraftPort,
						cidrBlocks: ['0.0.0.0/0'],
						ipv6CidrBlocks: ['::/0'],
					},
					{
						protocol: 'tcp',
						fromPort: minecraftRconPort,
						toPort: minecraftRconPort,
						securityGroups: [rconBridgeSecurityGroup.id],
					},
				],
				egress: [
					{
						protocol: '-1',
						fromPort: 0,
						toPort: 0,
						cidrBlocks: ['0.0.0.0/0'],
						ipv6CidrBlocks: ['::/0'],
					},
				],
				tags,
			},
			{ parent: this }
		);

		const efsSecurityGroup = new aws.ec2.SecurityGroup(
			resourceName('efs_sg'),
			{
				description: 'Minecraft EFS ingress',
				vpcId: vpc.id,
				ingress: [
					{
						protocol: 'tcp',
						fromPort: 2049,
						toPort: 2049,
						securityGroups: [taskSecurityGroup.id],
					},
				],
				egress: [
					{
						protocol: '-1',
						fromPort: 0,
						toPort: 0,
						cidrBlocks: ['0.0.0.0/0'],
						ipv6CidrBlocks: ['::/0'],
					},
				],
				tags,
			},
			{ parent: this }
		);

		const privateDnsZone = new aws.route53.Zone(
			resourceName('private_zone'),
			{
				name: `internal.${publicDomain}`,
				vpcs: [{ vpcId: vpc.id }],
				tags,
			},
			{ parent: this }
		);

		const rconDomain = `rcon.internal.${publicDomain}`;

		new aws.route53.Record(
			resourceName('rcon_dns'),
			{
				zoneId: privateDnsZone.id,
				name: rconDomain,
				type: 'A',
				ttl: 30,
				records: ['10.42.0.254'],
			},
			{ parent: this, ignoreChanges: ['records[0]'] }
		);

		const fileSystem = new aws.efs.FileSystem(
			resourceName('data'),
			{
				encrypted: true,
				tags,
			},
			{ parent: this, protect: args.environmentName === 'production' }
		);

		const accessPoint = new aws.efs.AccessPoint(
			resourceName('data_access_point'),
			{
				fileSystemId: fileSystem.id,
				posixUser: {
					gid: 1000,
					uid: 1000,
				},
				rootDirectory: {
					path: '/minecraft',
					creationInfo: {
						ownerGid: 1000,
						ownerUid: 1000,
						permissions: '0775',
					},
				},
				tags,
			},
			{ parent: this }
		);

		const mountTarget = new aws.efs.MountTarget(
			resourceName('data_mount_target'),
			{
				fileSystemId: fileSystem.id,
				securityGroups: [efsSecurityGroup.id],
				subnetId: subnet.id,
			},
			{ parent: this }
		);

		const cluster = new aws.ecs.Cluster(
			resourceName('cluster'),
			{
				name: sanitizeAwsAlphaNumericHyphenUnderscoreName(
					`${alphaNumericPhysicalNamePrefix}_cluster`
				),
				settings: [{ name: 'containerInsights', value: 'enabled' }],
				tags,
			},
			{ parent: this }
		);

		const executionRole = new aws.iam.Role(
			resourceName('execution_role'),
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'ecs-tasks.amazonaws.com',
				}),
				managedPolicyArns: [
					aws.iam.ManagedPolicy.AmazonECSTaskExecutionRolePolicy,
				],
				tags,
			},
			{ parent: this }
		);

		const taskRole = new aws.iam.Role(
			resourceName('task_role'),
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'ecs-tasks.amazonaws.com',
				}),
				tags,
			},
			{ parent: this }
		);

		const taskLogGroup = new aws.cloudwatch.LogGroup(
			resourceName('task_logs'),
			{
				retentionInDays: 14,
				tags,
			},
			{ parent: this }
		);
		this.taskLogGroupArn = taskLogGroup.arn;
		this.taskLogGroupName = taskLogGroup.name;

		const rconPassword = new random.RandomPassword(
			resourceName('rcon_password'),
			{
				length: 32,
				special: false,
			},
			{ parent: this }
		);

		const taskDefinition = new aws.ecs.TaskDefinition(
			resourceName('task'),
			{
				cpu: '1024',
				memory: '2048',
				executionRoleArn: executionRole.arn,
				family: sanitizeAwsEcsTaskFamilyName(
					`${alphaNumericPhysicalNamePrefix}_task`
				),
				networkMode: 'awsvpc',
				requiresCompatibilities: ['FARGATE'],
				taskRoleArn: taskRole.arn,
				containerDefinitions: Pulumi.all([
					taskLogGroup.name,
					args.operators ?? [],
					rconPassword.result,
				]).apply(([logGroupName, operators, rconPasswordValue]) => {
					const allowList = [...new Set(operators)];
					return JSON.stringify([
						{
							name: 'minecraft',
							image: minecraftServerImage,
							essential: true,
							portMappings: [
								{
									containerPort: minecraftPort,
									hostPort: minecraftPort,
									protocol: 'tcp',
								},
								{
									containerPort: minecraftRconPort,
									hostPort: minecraftRconPort,
									protocol: 'tcp',
								},
							],
								mountPoints: [
									{
										containerPath: '/data',
										sourceVolume: 'minecraft_data',
									},
								],
							environment: [
								{ name: 'EULA', value: 'TRUE' },
								{ name: 'MEMORY', value: '1536M' },
								{
									name: 'MOTD',
									value: 'zemn.me on-demand Minecraft',
								},
								{ name: 'ENABLE_AUTOSTOP', value: 'TRUE' },
								{ name: 'AUTOSTOP_TIMEOUT_EST', value: '900' },
								{
									name: 'AUTOSTOP_TIMEOUT_INIT',
									value: '1200',
								},
								{ name: 'AUTOSTOP_PERIOD', value: '10' },
								{ name: 'ENABLE_RCON', value: 'TRUE' },
								{
									name: 'RCON_PORT',
									value: String(minecraftRconPort),
								},
								{
									name: 'RCON_PASSWORD',
									value: rconPasswordValue,
								},
								...(operators.length > 0
									? [
											{
												name: 'OPS',
												value: operators.join(','),
											},
										]
									: []),
								...(allowList.length > 0
									? [
											{
												name: 'ENABLE_WHITELIST',
												value: 'TRUE',
											},
											{
												name: 'ENFORCE_WHITELIST',
												value: 'TRUE',
											},
											{
												name: 'WHITELIST',
												value: allowList.join(','),
											},
										]
									: []),
							],
							logConfiguration: {
								logDriver: 'awslogs',
								options: {
									'awslogs-group': logGroupName,
									'awslogs-region': aws.config.region,
									'awslogs-stream-prefix': 'minecraft',
								},
							},
						},
					]);
				}),
				volumes: [
					{
						name: 'minecraft_data',
						efsVolumeConfiguration: {
							fileSystemId: fileSystem.id,
							transitEncryption: 'ENABLED',
							authorizationConfig: {
								accessPointId: accessPoint.id,
							},
						},
					},
				],
				tags,
			},
			{ parent: this, dependsOn: [mountTarget] }
		);

		const service = new aws.ecs.Service(
			resourceName('service'),
			{
				cluster: cluster.arn,
				desiredCount: 0,
				launchType: 'FARGATE',
				name: sanitizeAwsAlphaNumericHyphenUnderscoreName(
					`${alphaNumericPhysicalNamePrefix}_service`
				),
				networkConfiguration: {
					assignPublicIp: true,
					securityGroups: [taskSecurityGroup.id],
					subnets: [subnet.id],
				},
				taskDefinition: taskDefinition.arn,
				waitForSteadyState: false,
				tags,
			},
			{
				parent: this,
				ignoreChanges: ['desiredCount'],
			}
		);

		const rconBridgeRole = new aws.iam.Role(
			resourceName('rcon_bridge_role'),
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'lambda.amazonaws.com',
				}),
				managedPolicyArns: [
					aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
					aws.iam.ManagedPolicy.AWSLambdaVPCAccessExecutionRole,
				],
				tags,
			},
			{ parent: this }
		);

		const rconBridgeFunction = new aws.lambda.Function(
			resourceName('rcon_bridge'),
			{
				code: new Pulumi.asset.AssetArchive({
					'index.js': new Pulumi.asset.StringAsset(
						rconBridgeLambdaCode()
					),
				}),
				handler: 'index.handler',
				name: sanitizeAwsLambdaFunctionName(
					`${alphaNumericPhysicalNamePrefix}_rcon_bridge`
				),
				role: rconBridgeRole.arn,
				runtime: aws.lambda.Runtime.NodeJS20dX,
				timeout: 10,
				environment: {
					variables: {
						RCON_HOST: rconDomain,
						RCON_PASSWORD: rconPassword.result,
						RCON_PORT: String(minecraftRconPort),
					},
				},
				vpcConfig: {
					securityGroupIds: [rconBridgeSecurityGroup.id],
					subnetIds: [subnet.id],
				},
				tags,
			},
			{ parent: this }
		);

		this.rconBridgeFunctionArn = rconBridgeFunction.arn;
		this.rconBridgeFunctionName = rconBridgeFunction.name;

		const wakeRole = new aws.iam.Role(
			resourceName('wake_role'),
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'lambda.amazonaws.com',
				}),
				managedPolicyArns: [
					aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
				],
				inlinePolicies: [
					{
						name: `${alphaNumericPhysicalNamePrefix}_ecs_scale`,
						policy: Pulumi.all([
							minecraftZoneId,
							privateDnsZone.id,
						]).apply(([publicZoneId, privateZoneId]) =>
							JSON.stringify({
								Version: '2012-10-17',
								Statement: [
									{
										Effect: 'Allow',
										Action: [
											'ecs:UpdateService',
											'ecs:DescribeServices',
											'ecs:DescribeTasks',
										],
										Resource: '*',
									},
									{
										Effect: 'Allow',
										Action: ['ec2:DescribeNetworkInterfaces'],
										Resource: '*',
									},
									{
										Effect: 'Allow',
										Action: [
											'route53:ChangeResourceRecordSets',
										],
										Resource: [publicZoneId, privateZoneId]
											.filter(
												(zoneId): zoneId is string =>
													typeof zoneId === 'string' &&
													zoneId.length > 0
											)
											.map(hostedZoneArn),
									},
								],
							})
						),
					},
				],
				tags,
			},
			{ parent: this }
		);

		const wakeFunction = new aws.lambda.Function(
			resourceName('wake'),
			{
				code: new Pulumi.asset.AssetArchive({
					'index.js': new Pulumi.asset.StringAsset(wakeLambdaCode()),
				}),
				handler: 'index.handler',
				name: sanitizeAwsLambdaFunctionName(
					`${alphaNumericPhysicalNamePrefix}_wake`
				),
				role: wakeRole.arn,
				runtime: aws.lambda.Runtime.NodeJS20dX,
				timeout: 30,
				environment: {
					variables: {
						ECS_CLUSTER_NAME: cluster.name,
						ECS_SERVICE_NAME: service.name,
						PRIVATE_DNS_HOSTED_ZONE_ID: privateDnsZone.id,
						PRIVATE_DNS_RECORD_NAMES: rconDomain,
						PRIVATE_DNS_STOPPED_ADDRESS: '10.42.0.254',
						PUBLIC_DNS_HOSTED_ZONE_ID: minecraftZoneId,
						PUBLIC_DNS_RECORD_NAMES: [
							publicDomain,
							serverDomain,
						].join(','),
						PUBLIC_DNS_STOPPED_ADDRESS: '192.0.2.1',
						WAKE_NAMES: wakeNames.join(','),
					},
				},
				tags,
			},
			{ parent: this }
		);

		this.wakeFunctionArn = wakeFunction.arn;
		this.wakeFunctionName = wakeFunction.name;

		const taskStateRule = new aws.cloudwatch.EventRule(
			resourceName('task_state'),
			{
				eventPattern: Pulumi.all([
					cluster.arn,
					taskDefinition.arn,
				]).apply(([clusterArn, taskDefinitionArn]) =>
					JSON.stringify({
						source: ['aws.ecs'],
						'detail-type': ['ECS Task State Change'],
						detail: {
							clusterArn: [clusterArn],
							lastStatus: ['RUNNING', 'STOPPED'],
							taskDefinitionArn: [taskDefinitionArn],
						},
					})
				),
				tags,
			},
			{ parent: this }
		);

		new aws.cloudwatch.EventTarget(
			resourceName('task_state_target'),
			{
				arn: wakeFunction.arn,
				rule: taskStateRule.name,
			},
			{ parent: this }
		);

		new aws.lambda.Permission(
			resourceName('eventbridge_permission'),
			{
				action: 'lambda:InvokeFunction',
				function: wakeFunction.name,
				principal: 'events.amazonaws.com',
				sourceArn: taskStateRule.arn,
				statementId: sanitizeAwsLambdaStatementId(
					resourceName('eventbridge_permission')
				),
			},
			{ parent: this }
		);

		if (manageDnsWake) {
			const queryLogGroup = new aws.cloudwatch.LogGroup(
				resourceName('dns_query_logs'),
				{
					name: `/aws/route53/${publicDomain}`,
					retentionInDays: 3,
					tags,
				},
				{ parent: this }
			);

			const route53LogPolicy = new aws.cloudwatch.LogResourcePolicy(
				resourceName('route53_query_log_policy'),
				{
					policyDocument: queryLogGroup.arn.apply(logGroupArn =>
						JSON.stringify({
							Version: '2012-10-17',
							Statement: [
								{
									Effect: 'Allow',
									Principal: {
										Service: 'route53.amazonaws.com',
									},
									Action: [
										'logs:CreateLogStream',
										'logs:PutLogEvents',
									],
									Resource: `${logGroupArn}:*`,
								},
							],
						})
					),
					policyName: `${alphaNumericPhysicalNamePrefix}_route53_query_logs`,
				},
				{ parent: this }
			);

			new aws.route53.QueryLog(
				resourceName('query_log'),
				{
					cloudwatchLogGroupArn: queryLogGroup.arn,
					zoneId: minecraftZoneId,
				},
				{ parent: this, dependsOn: [route53LogPolicy] }
			);

			const logsPermission = new aws.lambda.Permission(
				resourceName('logs_permission'),
				{
					action: 'lambda:InvokeFunction',
					function: wakeFunction.name,
					principal: 'logs.amazonaws.com',
					sourceArn: Pulumi.interpolate`${queryLogGroup.arn}:*`,
					statementId: sanitizeAwsLambdaStatementId(
						resourceName('logs_permission')
					),
				},
				{ parent: this }
			);

			new aws.cloudwatch.LogSubscriptionFilter(
				resourceName('dns_query_filter'),
				{
					destinationArn: wakeFunction.arn,
					filterPattern: 'minecraft',
					logGroup: queryLogGroup.name,
				},
				{ parent: this, dependsOn: [logsPermission] }
			);
		}

		new aws.route53.Record(
			resourceName('server_dns'),
			{
				zoneId: minecraftZoneId,
				name: serverDomain,
				type: 'A',
				ttl: 30,
				records: ['192.0.2.1'],
			},
			{
				parent: this,
				deleteBeforeReplace: true,
				ignoreChanges: ['records[0]'],
			}
		);

		new aws.route53.Record(
			resourceName('public_dns'),
			{
				zoneId: minecraftZoneId,
				name: publicDomain,
				type: 'A',
				ttl: 30,
				records: ['192.0.2.1'],
			},
			{
				parent: this,
				deleteBeforeReplace: true,
				ignoreChanges: ['records[0]'],
			}
		);

		srvPlayerDomains.forEach(domain => {
			new aws.route53.Record(
				resourceName(`srv_dns_${domain.replaceAll('.', '_')}`),
				{
					zoneId: domain === args.domain ? args.zoneId : minecraftZoneId,
					name: `_minecraft._tcp.${domain}`,
					type: 'SRV',
					ttl: 60,
					records: [`0 0 ${minecraftPort} ${serverDomain}.`],
				},
				{ parent: this }
			);
		});

		this.registerOutputs({
			clusterName: cluster.name,
			publicDomain,
			rconBridgeFunctionArn: this.rconBridgeFunctionArn,
			rconBridgeFunctionName: this.rconBridgeFunctionName,
			serverDomain,
			serviceName: service.name,
			taskLogGroupArn: this.taskLogGroupArn,
			taskLogGroupName: this.taskLogGroupName,
			wakeFunctionArn: this.wakeFunctionArn,
			wakeFunctionName: this.wakeFunctionName,
		});
	}
}
