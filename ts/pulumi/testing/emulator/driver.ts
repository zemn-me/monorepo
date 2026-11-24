/* biome-ignore-all lint/suspicious/noConsole: integration test progress belongs in the test log */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { createServer as tcpServer } from 'node:net';
import path from 'node:path';
import { promisify } from 'node:util';

import { runfiles } from '@bazel/runfiles';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import {
	type ConfigMap,
	LocalWorkspace,
} from '@pulumi/pulumi/automation/index.js';

import { pulumiCommand } from '#root/ts/pulumi/cli.js';
import { Component } from '#root/ts/pulumi/index.js';
import { compatibilityGateway } from '#root/ts/pulumi/testing/emulator/runtime/compatibility.js';
import { configuration } from '#root/ts/pulumi/testing/emulator/runtime/configuration.js';

const require = createRequire(import.meta.url);
const scenario = process.env['EMULATOR_SCENARIO'];
assert(
	scenario === 'staging' || scenario === 'production',
	'Expected staging or production'
);
const featureTests = process.argv.includes('--zemn-features');
const onOutput = featureTests ? undefined : console.log;
const config = configuration();
const gateway = await compatibilityGateway();
try {
	// A request's path must never become a new upstream authority.
	let unexpectedConnections = 0;
	const sentinel = tcpServer(socket => {
		unexpectedConnections++;
		socket.destroy();
	});
	await new Promise<void>(resolve =>
		sentinel.listen(0, '127.0.0.1', resolve)
	);
	try {
		const address = sentinel.address();
		assert(address && typeof address !== 'string');
		const gatewayHost = new URL(gateway.endpoint).host;
		const send = (requestPath: string) =>
			new Promise<{ status: number; body: string }>((resolve, reject) => {
				const request = httpRequest(
					gateway.endpoint,
					{ path: requestPath, headers: { host: gatewayHost } },
					response => {
						const chunks: Buffer[] = [];
						response.on('data', chunk =>
							chunks.push(Buffer.from(chunk))
						);
						response.on('error', reject);
						response.on('end', () =>
							resolve({
								status: response.statusCode ?? 0,
								body: Buffer.concat(chunks).toString(),
							})
						);
					}
				);
				request.on('error', reject);
				request.end();
			});
		await send(
			`https://${gatewayHost}//127.0.0.1:${address.port}/must-stay-on-emulator`
		);
		assert.equal(
			unexpectedConnections,
			0,
			'Gateway connected to a hostname supplied in the request path'
		);
		const invalid = await send('https://%');
		// Go's HTTP parser rejects malformed authorities before routing.
		assert.equal(invalid.status, 400);
		assert.equal(invalid.body, '400 Bad Request');
	} finally {
		await new Promise<void>((resolve, reject) =>
			sentinel.close(error => (error ? reject(error) : resolve()))
		);
	}
	const root = await mkdtemp(path.join(config.directory, `${scenario}-`));
	const home = path.join(root, 'pulumi-home');
	const backend = path.join(root, 'state');
	await mkdir(backend, { recursive: true });
	const sdkVersion = async (name: string): Promise<string> => {
		const metadata = JSON.parse(
			await readFile(
				require.resolve(`@pulumi/${name}/package.json`),
				'utf8'
			)
		) as { version: string };
		return metadata.version;
	};
	for (const name of ['aws', 'random', 'gcp', 'command']) {
		const location = process.env[`PROVIDER_${name.toUpperCase()}`];
		assert(location, `Missing ${name} provider runfile`);
		const binary = runfiles.resolve(location);
		const version = await sdkVersion(name);
		if (name === 'aws' || name === 'random') {
			const { stdout } = await promisify(execFile)(binary, ['--version']);
			assert.equal(
				stdout.trim().replace(/^v/, ''),
				version,
				`${name} SDK and provider must match`
			);
		}
		const directory = path.join(
			home,
			'plugins',
			`resource-${name}-v${version}`
		);
		await mkdir(directory, { recursive: true });
		await symlink(binary, path.join(directory, `pulumi-resource-${name}`));
	}
	const credentials = await readFile(config.credentials, 'utf8');
	const credential = (name: string): string => {
		const value = credentials
			.match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))?.[1]
			?.trim();
		assert(value, `Missing emulator ${name}`);
		return value;
	};
	const envVars = {
		PULUMI_HOME: home,
		PULUMI_BACKEND_URL: `file://${backend}`,
		PULUMI_CONFIG_PASSPHRASE: 'isolated-emulator-test',
		PULUMI_SKIP_UPDATE_CHECK: 'true',
		PULUMI_DISABLE_AUTOMATIC_PLUGIN_ACQUISITION: 'true',
		AWS_ACCESS_KEY_ID: credential('aws_access_key_id'),
		AWS_SECRET_ACCESS_KEY: credential('aws_secret_access_key'),
		AWS_SESSION_TOKEN: '',
		AWS_PROFILE: '',
		AWS_WEB_IDENTITY_TOKEN_FILE: '',
		AWS_ROLE_ARN: '',
		AWS_SHARED_CREDENTIALS_FILE: config.credentials,
		AWS_CONFIG_FILE: path.join(root, 'aws-config'),
		AWS_CA_BUNDLE: config.certificate,
		SSL_CERT_FILE: config.certificate,
		AWS_ENDPOINT_URL: gateway.endpoint,
		AWS_EC2_METADATA_DISABLED: 'true',
		AWS_REGION: 'us-east-1',
		AWS_DEFAULT_REGION: 'us-east-1',
		// Any accidentally unconfigured cloud endpoint must fail locally.
		HTTPS_PROXY: 'http://127.0.0.1:9',
		HTTP_PROXY: gateway.endpoint,
		NO_PROXY: '127.0.0.1,localhost',
	};
	await writeFile(envVars.AWS_CONFIG_FILE, '');
	const endpoint = gateway.endpoint;
	const endpoints: aws.types.input.ProviderEndpoint = {
		acm: endpoint,
		apigateway: endpoint,
		apigatewayv2: endpoint,
		appautoscaling: endpoint,
		autoscaling: endpoint,
		budgets: endpoint,
		cloudfront: endpoint,
		cloudwatch: endpoint,
		cloudwatchlogs: endpoint,
		connect: endpoint,
		costexplorer: endpoint,
		dynamodb: endpoint,
		ec2: endpoint,
		ecr: endpoint,
		ecs: endpoint,
		elb: endpoint,
		elbv2: endpoint,
		elasticsearch: endpoint,
		events: endpoint,
		iam: endpoint,
		kms: endpoint,
		lambda: endpoint,
		route53: endpoint,
		route53domains: endpoint,
		route53resolver: endpoint,
		s3: endpoint,
		s3control: endpoint,
		secretsmanager: endpoint,
		ses: endpoint,
		servicediscovery: endpoint,
		sns: endpoint,
		sqs: endpoint,
		ssm: endpoint,
		sts: endpoint,
	};
	const settings: ConfigMap = {
		'aws:region': { value: 'us-east-1' },
		// A dropped loopback connection during the update can be retried by the provider.
		'aws:maxRetries': { value: '3' },
		'aws:endpoints': { value: JSON.stringify([endpoints]) },
		'aws:s3UsePathStyle': { value: 'true' },
		'aws:customCaBundle': { value: config.certificate },
		'aws:allowedAccountIds': { value: JSON.stringify(['000000000000']) },
	};
	const cli = await pulumiCommand();
	const workspace = (directory: string) => ({
		workDir: directory,
		pulumiHome: home,
		pulumiCommand: cli,
		envVars,
	});
	const seedDir = path.join(root, 'fixtures');
	await mkdir(seedDir);
	const fixtures = await LocalWorkspace.createStack(
		{
			projectName: 'aws-emulator-fixtures',
			stackName: 'fixtures',
			async program() {
				const zones: Record<string, pulumi.Output<string>> = {};
				for (const domain of [
					'shadwell.im',
					'zemn.me',
					'pleaseintroducemetoyour.dog',
					'eggsfordogs.com',
					'waxingincandescent.com',
					'baby.computer',
				]) {
					zones[domain] = new aws.route53.Zone(
						domain.replaceAll('.', '-'),
						{ name: domain }
					).zoneId;
				}
				const contact = {
					addressLine1: '123 Example Street',
					city: 'Seattle',
					contactType: 'PERSON',
					countryCode: 'US',
					email: 'emulator@example.com',
					firstName: 'Test',
					lastName: 'Fixture',
					phoneNumber: '+1.2065550100',
					state: 'WA',
					zipCode: '98101',
				};
				new aws.route53domains.Domain('baby-registration', {
					domainName: 'baby.computer',
					durationInYears: 1,
					transferLock: false,
					autoRenew: false,
					adminContact: contact,
					registrantContact: contact,
					techContact: contact,
				});
				return zones;
			},
		},
		workspace(seedDir)
	);
	await fixtures.setAllConfig(settings);
	await fixtures.up({ onOutput });
	const zones = await fixtures.outputs();
	const zone = (domain: string): string => {
		const value: unknown = zones[domain]?.value;
		assert.equal(typeof value, 'string', `Missing fixture zone ${domain}`);
		return value as string;
	};
	const expected: string[] = [];
	const assetFixtures: string[] = [];
	const workDir = path.join(root, scenario);
	await mkdir(workDir);
	const stack = await LocalWorkspace.createStack(
		{
			projectName: 'monorepo-emulator',
			stackName: scenario,
			async program() {
				pulumi.runtime.registerStackTransformation(args => {
					if (args.type.startsWith('aws:'))
						expected.push(`${args.type}::${args.name}`);
					const fixtureAsset =
						args.type === 'aws:s3/bucketObjectv2:BucketObjectv2' &&
						args.props['source'] !== undefined;
					if (fixtureAsset) assetFixtures.push(args.name);
					return {
						props: fixtureAsset
							? {
									...args.props,
									source: new pulumi.asset.StringAsset(
										'AWS Emulator asset fixture'
									),
								}
							: args.props,
						opts: {
							...args.opts,
							customTimeouts: {
								create: '1m',
								update: '1m',
								delete: '1m',
							},
							...(args.type.startsWith('gcp:')
								? { import: undefined }
								: {}),
						},
					};
				});
				const component = new Component('monorepo', {
					staging: scenario === 'staging',
					callboxPhoneNumber: '+12065550100',
					existingZoneIds: {
						shadwell: zone('shadwell.im'),
						zemn: zone('zemn.me'),
						pleaseIntroduceMeToYourDog: zone(
							'pleaseintroducemetoyour.dog'
						),
					},
					openAIIdentityProviderId: 'emulator-idp',
					openAIServiceAccountId: 'emulator-service-account',
				});
				const outputs = {
					journalWorkerRoleArn: component.journalWorkerRoleArn,
				};
				if (!featureTests) return outputs;

				// S3 invokes the deployed worker. Its image cannot run in the emulator,
				// so forward Lambda's invocation record to the local Go worker.
				const api = component.zemnMe.api;
				const queue = new aws.sqs.Queue('journal-worker-invocations');
				const grant = new aws.iam.RolePolicy(
					'journal-invocation-delivery',
					{
						role: api.journalWorkerRole.name,
						policy: pulumi.jsonStringify({
							Version: '2012-10-17',
							Statement: [
								{
									Effect: 'Allow',
									Action: 'sqs:SendMessage',
									Resource: queue.arn,
								},
							],
						}),
					}
				);
				new aws.lambda.FunctionEventInvokeConfig(
					'journal-worker-invocations',
					{
						functionName: api.journalWorker.name,
						maximumRetryAttempts: 0,
						destinationConfig: {
							onFailure: { destination: queue.arn },
						},
					},
					{ dependsOn: grant }
				);
				const environment = api.lambdaFunction.environment.apply(env =>
					Object.fromEntries(
						[
							'DYNAMODB_TABLE_NAME',
							'ANALYTICS_TABLE_NAME',
							'GRIEVANCES_TABLE_NAME',
							'USERS_TABLE_NAME',
							'CALLBOX_KEY_TABLE_NAME',
							'OAUTH_TABLE_NAME',
							'JOURNAL_TABLE_NAME',
							'JOURNAL_BUCKET_NAME',
							'OIDC_JWT_KMS_KEY_ID',
							'OIDC_JWT_PUBLIC_KEY',
						].map(name => {
							const value = env?.variables?.[name];
							assert(
								value,
								`Missing Lambda environment variable ${name}`
							);
							return [name, value];
						})
					)
				);
				// Only these public resource names and the public signing key leave Pulumi.
				return {
					...outputs,
					deployment: {
						environment: pulumi.unsecret(environment),
						journalQueueURL: queue.url,
					},
				};
			},
		},
		workspace(workDir)
	);
	await stack.setAllConfig(settings);
	let updateError: unknown;
	const diagnostics: { urn?: string; message: string }[] = [];
	try {
		await stack.up({
			onOutput,
			continueOnError: !featureTests,
			onEvent(event) {
				const diagnostic = event.diagnosticEvent;
				if (diagnostic?.severity === 'error') {
					diagnostics.push({
						urn: diagnostic.urn,
						message: diagnostic.message,
					});
				}
			},
		});
	} catch (error) {
		updateError = error;
	}
	const state = await stack.exportStack();
	interface StateResource {
		type: string;
		urn: string;
		id?: string;
		external?: boolean;
	}
	const { resources } = state.deployment as { resources: StateResource[] };
	assert(Array.isArray(resources), 'Pulumi returned no resource state');
	const actual = resources.filter(resource =>
		resource.type.startsWith('aws:')
	);
	const gatewayReport = await gateway.report();
	await writeFile(
		path.join(
			process.env['TEST_UNDECLARED_OUTPUTS_DIR'] ?? root,
			`${scenario}-aws-resources.json`
		),
		JSON.stringify(
			{
				scenario,
				declared: expected,
				resources: actual.map(resource => ({
					type: resource.type,
					urn: resource.urn,
					id: resource.id,
				})),
				deploymentSucceeded: updateError === undefined,
				mockedOperations: gatewayReport.calls,
				mockedAssetPayloads: assetFixtures,
				emulatorRequests: gatewayReport.forwardedRequests,
				diagnostics,
			},
			null,
			2
		)
	);
	console.log(
		`${scenario}: ${actual.filter(resource => resource.id).length} AWS resources recorded; ${diagnostics.length} errors.`
	);
	if (updateError !== undefined) {
		if (featureTests && diagnostics.length > 0)
			throw new Error(
				diagnostics.map(diagnostic => diagnostic.message).join('\n')
			);
		throw updateError;
	}
	assert(
		expected.length > 0,
		'The infrastructure registered no AWS resources'
	);
	assert.deepEqual(
		actual
			.map(
				resource =>
					`${resource.type}::${resource.urn.split('::').at(-1)}`
			)
			.sort(),
		expected.sort()
	);
	assert(
		actual.every(resource => resource.id),
		'An AWS resource has no provider-assigned ID'
	);
	assert(
		actual.some(
			resource =>
				resource.type === 'aws:cloudfront/distribution:Distribution'
		)
	);
	assert(
		actual.some(
			resource => resource.type === 'aws:lambda/function:Function'
		)
	);
	if (scenario === 'production') {
		assert(
			actual.some(
				resource =>
					resource.type === 'aws:route53domains/domain:Domain' &&
					!resource.external
			)
		);
		assert(
			actual.some(
				resource =>
					resource.type ===
					'aws:iam/openIdConnectProvider:OpenIdConnectProvider'
			)
		);
	}
	console.log(
		`Created/read all ${actual.length} AWS resources in the ${scenario} configuration.`
	);
	if (featureTests) {
		const deployment = (await stack.outputs())['deployment'];
		assert(
			deployment && !deployment.secret,
			'Missing public zemn.me deployment outputs'
		);
		await writeFile(
			path.join(config.directory, 'zemn-deployment.json'),
			JSON.stringify(deployment.value),
			{ flag: 'wx' }
		);
	}
	// Each service_test owns its emulator process. Stopping it discards every resource,
	// including intentionally protected databases and retained domain registrations.
} finally {
	gateway.close();
}
