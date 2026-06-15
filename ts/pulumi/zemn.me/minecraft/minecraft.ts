import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';

import {
	sanitizeAwsAlphaNumericHyphenUnderscoreName,
	sanitizeAwsElbv2Name,
	sanitizeAwsTargetGroupName,
} from '#root/ts/pulumi/lib/awsNames.js';
import { mergeTags, TagSet, tagTrue } from '#root/ts/pulumi/lib/tags.js';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	operators?: Pulumi.Input<Pulumi.Input<string>[]>;
	tags?: TagSet;
}

const minecraftPort = 25565;

function wakeLambdaCode(): string {
	return `
const zlib = require("node:zlib");
const { ECSClient, UpdateServiceCommand } = require("@aws-sdk/client-ecs");

const ecs = new ECSClient({});
const cluster = process.env.ECS_CLUSTER_NAME;
const service = process.env.ECS_SERVICE_NAME;
const wakeNames = (process.env.WAKE_NAMES || "")
	.split(",")
	.map(v => v.trim().toLowerCase())
	.filter(Boolean);

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

exports.handler = async event => {
	if (event.source === "aws.ecs" && event["detail-type"] === "ECS Task State Change") {
		if (event.detail?.lastStatus === "STOPPED") {
			await scale(0, "minecraft task stopped");
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

export class MinecraftOnDemand extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:zemn.me:MinecraftOnDemand', name, args, opts);

		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));
		const publicDomain = ['minecraft', args.domain].join('.');
		const playerDomains = [args.domain, publicDomain];
		const serverDomain = ['minecraft-server', args.domain].join('.');

		const vpc = new aws.ec2.Vpc(
			`${name}-vpc`,
			{
				cidrBlock: '10.42.0.0/16',
				enableDnsHostnames: true,
				enableDnsSupport: true,
				tags,
			},
			{ parent: this }
		);

		const internetGateway = new aws.ec2.InternetGateway(
			`${name}-igw`,
			{
				vpcId: vpc.id,
				tags,
			},
			{ parent: this }
		);

		const subnet = new aws.ec2.Subnet(
			`${name}-public-subnet`,
			{
				cidrBlock: '10.42.0.0/24',
				mapPublicIpOnLaunch: true,
				vpcId: vpc.id,
				tags,
			},
			{ parent: this }
		);

		const routeTable = new aws.ec2.RouteTable(
			`${name}-public-route-table`,
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
			`${name}-public-route-table-association`,
			{
				routeTableId: routeTable.id,
				subnetId: subnet.id,
			},
			{ parent: this }
		);

		const taskSecurityGroup = new aws.ec2.SecurityGroup(
			`${name}-task-sg`,
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
			`${name}-efs-sg`,
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

		const fileSystem = new aws.efs.FileSystem(
			`${name}-data`,
			{
				encrypted: true,
				tags,
			},
			{ parent: this, protect: true }
		);

		const accessPoint = new aws.efs.AccessPoint(
			`${name}-data-access-point`,
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
			`${name}-data-mount-target`,
			{
				fileSystemId: fileSystem.id,
				securityGroups: [efsSecurityGroup.id],
				subnetId: subnet.id,
			},
			{ parent: this }
		);

		const loadBalancer = new aws.lb.LoadBalancer(
			`${name}-nlb`,
			{
				name: sanitizeAwsElbv2Name(`${name}-nlb`),
				loadBalancerType: 'network',
				subnets: [subnet.id],
				tags,
			},
			{ parent: this }
		);

		const targetGroup = new aws.lb.TargetGroup(
			`${name}-tg`,
			{
				name: sanitizeAwsTargetGroupName(`${name}-tg`),
				port: minecraftPort,
				protocol: 'TCP',
				targetType: 'ip',
				vpcId: vpc.id,
				healthCheck: {
					enabled: true,
					healthyThreshold: 2,
					interval: 30,
					protocol: 'TCP',
					unhealthyThreshold: 2,
				},
				tags,
			},
			{ parent: this }
		);

		new aws.lb.Listener(
			`${name}-listener`,
			{
				loadBalancerArn: loadBalancer.arn,
				port: minecraftPort,
				protocol: 'TCP',
				defaultActions: [
					{
						type: 'forward',
						targetGroupArn: targetGroup.arn,
					},
				],
				tags,
			},
			{ parent: this }
		);

		const cluster = new aws.ecs.Cluster(
			`${name}-cluster`,
			{
				name: sanitizeAwsAlphaNumericHyphenUnderscoreName(`${name}-cluster`),
				settings: [{ name: 'containerInsights', value: 'enabled' }],
				tags,
			},
			{ parent: this }
		);

		const executionRole = new aws.iam.Role(
			`${name}-execution-role`,
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
			`${name}-task-role`,
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'ecs-tasks.amazonaws.com',
				}),
				tags,
			},
			{ parent: this }
		);

		const taskLogGroup = new aws.cloudwatch.LogGroup(
			`${name}-task-logs`,
			{
				retentionInDays: 14,
				tags,
			},
			{ parent: this }
		);

		const taskDefinition = new aws.ecs.TaskDefinition(
			`${name}-task`,
			{
				cpu: '1024',
				memory: '2048',
				executionRoleArn: executionRole.arn,
				family: `${name}-minecraft`,
				networkMode: 'awsvpc',
				requiresCompatibilities: ['FARGATE'],
				taskRoleArn: taskRole.arn,
				containerDefinitions: Pulumi.all([
					taskLogGroup.name,
					args.operators ?? [],
				]).apply(
					([logGroupName, operators]) => {
						const allowList = [...new Set(operators)];
						return JSON.stringify([
							{
								name: 'minecraft',
								image: 'itzg/minecraft-server:java21',
								essential: true,
								portMappings: [
									{
										containerPort: minecraftPort,
										hostPort: minecraftPort,
										protocol: 'tcp',
									},
								],
								mountPoints: [
									{
										containerPath: '/data',
										sourceVolume: 'minecraft-data',
									},
								],
								environment: [
									{ name: 'EULA', value: 'TRUE' },
									{ name: 'MEMORY', value: '1536M' },
									{ name: 'MOTD', value: 'zemn.me on-demand Minecraft' },
									{ name: 'ENABLE_AUTOSTOP', value: 'TRUE' },
									{ name: 'AUTOSTOP_TIMEOUT_EST', value: '900' },
									{ name: 'AUTOSTOP_TIMEOUT_INIT', value: '1200' },
									{ name: 'AUTOSTOP_PERIOD', value: '10' },
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
												{ name: 'ENABLE_WHITELIST', value: 'TRUE' },
												{ name: 'ENFORCE_WHITELIST', value: 'TRUE' },
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
					}
				),
				volumes: [
					{
						name: 'minecraft-data',
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
			`${name}-service`,
			{
				cluster: cluster.arn,
				desiredCount: 0,
				launchType: 'FARGATE',
				loadBalancers: [
					{
						containerName: 'minecraft',
						containerPort: minecraftPort,
						targetGroupArn: targetGroup.arn,
					},
				],
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

		const wakeRole = new aws.iam.Role(
			`${name}-wake-role`,
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'lambda.amazonaws.com',
				}),
				managedPolicyArns: [aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole],
				inlinePolicies: [
					{
						name: `${name}-ecs-scale`,
						policy: JSON.stringify({
							Version: '2012-10-17',
							Statement: [
								{
									Effect: 'Allow',
									Action: ['ecs:UpdateService', 'ecs:DescribeServices'],
									Resource: '*',
								},
							],
						}),
					},
				],
				tags,
			},
			{ parent: this }
		);

		const wakeFunction = new aws.lambda.Function(
			`${name}-wake`,
			{
				code: new Pulumi.asset.AssetArchive({
					'index.js': new Pulumi.asset.StringAsset(wakeLambdaCode()),
				}),
				handler: 'index.handler',
				role: wakeRole.arn,
				runtime: aws.lambda.Runtime.NodeJS20dX,
				timeout: 30,
				environment: {
					variables: {
						ECS_CLUSTER_NAME: cluster.name,
						ECS_SERVICE_NAME: service.name,
						WAKE_NAMES: playerDomains
							.flatMap(domain => [
								domain,
								`${domain}.`,
								`_minecraft._tcp.${domain}`,
								`_minecraft._tcp.${domain}.`,
							])
							.join(','),
					},
				},
				tags,
			},
			{ parent: this }
		);

		const taskStoppedRule = new aws.cloudwatch.EventRule(
			`${name}-task-stopped`,
			{
				eventPattern: Pulumi.all([cluster.arn, taskDefinition.arn]).apply(
					([clusterArn, taskDefinitionArn]) =>
						JSON.stringify({
							source: ['aws.ecs'],
							'detail-type': ['ECS Task State Change'],
							detail: {
								clusterArn: [clusterArn],
								lastStatus: ['STOPPED'],
								taskDefinitionArn: [taskDefinitionArn],
							},
						})
				),
				tags,
			},
			{ parent: this }
		);

		new aws.cloudwatch.EventTarget(
			`${name}-task-stopped-target`,
			{
				arn: wakeFunction.arn,
				rule: taskStoppedRule.name,
			},
			{ parent: this }
		);

		new aws.lambda.Permission(
			`${name}-eventbridge-permission`,
			{
				action: 'lambda:InvokeFunction',
				function: wakeFunction.name,
				principal: 'events.amazonaws.com',
				sourceArn: taskStoppedRule.arn,
			},
			{ parent: this }
		);

		const queryLogGroup = new aws.cloudwatch.LogGroup(
			`${name}-dns-query-logs`,
			{
				name: `/aws/route53/${publicDomain}`,
				retentionInDays: 3,
				tags,
			},
			{ parent: this }
		);

		const route53LogPolicy = new aws.cloudwatch.LogResourcePolicy(
			`${name}-route53-query-log-policy`,
			{
				policyDocument: queryLogGroup.arn.apply(logGroupArn =>
					JSON.stringify({
						Version: '2012-10-17',
						Statement: [
							{
								Effect: 'Allow',
								Principal: { Service: 'route53.amazonaws.com' },
								Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
								Resource: `${logGroupArn}:*`,
							},
						],
					})
				),
				policyName: `${name}-route53-query-logs`,
			},
			{ parent: this }
		);

		new aws.route53.QueryLog(
			`${name}-query-log`,
			{
				cloudwatchLogGroupArn: queryLogGroup.arn,
				zoneId: args.zoneId,
			},
			{ parent: this, dependsOn: [route53LogPolicy] }
		);

		const logsPermission = new aws.lambda.Permission(
			`${name}-logs-permission`,
			{
				action: 'lambda:InvokeFunction',
				function: wakeFunction.name,
				principal: 'logs.amazonaws.com',
				sourceArn: Pulumi.interpolate`${queryLogGroup.arn}:*`,
			},
			{ parent: this }
		);

		new aws.cloudwatch.LogSubscriptionFilter(
			`${name}-dns-query-filter`,
			{
				destinationArn: wakeFunction.arn,
				filterPattern: 'minecraft',
				logGroup: queryLogGroup.name,
			},
			{ parent: this, dependsOn: [logsPermission] }
		);

		new aws.route53.Record(
			`${name}-server-dns`,
			{
				zoneId: args.zoneId,
				name: serverDomain,
				type: 'A',
				aliases: [
					{
						name: loadBalancer.dnsName,
						zoneId: loadBalancer.zoneId,
						evaluateTargetHealth: false,
					},
				],
			},
			{ parent: this }
		);

		new aws.route53.Record(
			`${name}-public-dns`,
			{
				zoneId: args.zoneId,
				name: publicDomain,
				type: 'A',
				aliases: [
					{
						name: loadBalancer.dnsName,
						zoneId: loadBalancer.zoneId,
						evaluateTargetHealth: false,
					},
				],
			},
			{ parent: this }
		);

		playerDomains.forEach(domain => {
			new aws.route53.Record(
				`${name}-srv-dns-${domain.replaceAll('.', '-')}`,
				{
					zoneId: args.zoneId,
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
			serverDomain,
			serviceName: service.name,
		});
	}
}
