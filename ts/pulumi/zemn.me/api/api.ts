import * as aws from '@pulumi/aws';
import * as Pulumi from '@pulumi/pulumi';

import { ApiZemnMeLambdaImage } from '#root/project/me/zemn/api/cmd/api/ApiZemnMeLambdaImage.js';
import { JournalWorkerLambdaImage } from '#root/project/me/zemn/api/cmd/journal_worker/JournalWorkerLambdaImage.js';
import { deriveBucketName } from '#root/ts/pulumi/lib/bucketName.js';
import Certificate from '#root/ts/pulumi/lib/certificate.js';
import { LambdaFunction } from '#root/ts/pulumi/lib/lambda_function.js';

const pick_env = <T extends string>(
	k: T
): Record<never, never> | Record<T, string> =>
	process.env[k] === undefined
		? {}
		: {
				[k]: process.env[k],
			};

export const openAIWorkloadIdentityAudience = 'https://api.openai.com/v1';

export interface Args {
	zoneId: Pulumi.Input<string>;
	domain: string;
	callboxPhoneNumber: Pulumi.Input<string>;
	protectDatabases: boolean;
	/**
	 * Used to auth calls from twilio to the api server.
	 */
	twilioSharedSecret: Pulumi.Input<string>;
	minecraftRconBridgeFunctionArn?: Pulumi.Input<string>;
	minecraftRconBridgeFunctionName?: Pulumi.Input<string>;
	minecraftLogGroupArn?: Pulumi.Input<string>;
	minecraftLogGroupName?: Pulumi.Input<string>;
	minecraftServerAddress?: Pulumi.Input<string>;
	minecraftWakeFunctionArn?: Pulumi.Input<string>;
	minecraftWakeFunctionName?: Pulumi.Input<string>;
	openAIIdentityProviderId?: Pulumi.Input<string>;
	openAIServiceAccountId?: Pulumi.Input<string>;
}

const lambdaImageCache = new Map<string, ApiZemnMeLambdaImage>();
const journalWorkerImageCache = new Map<string, JournalWorkerLambdaImage>();

export class ApiZemnMe extends Pulumi.ComponentResource {
	readonly journalWorkerRoleArn: Pulumi.Output<string>;

	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:zemn.me:api', name, args, opts);

		if (
			(args.openAIIdentityProviderId === undefined) !==
			(args.openAIServiceAccountId === undefined)
		) {
			throw new Error(
				'openAIIdentityProviderId and openAIServiceAccountId must be configured together'
			);
		}

		const oidcKey = new aws.kms.Key(
			`${name}-oidc-key`,
			{
				customerMasterKeySpec: 'ECC_NIST_P256',
				keyUsage: 'SIGN_VERIFY',
			},
			{ parent: this }
		);

		const oidcPublicKey = oidcKey.keyId.apply(id =>
			aws.kms
				.getPublicKey({ keyId: id })
				.then(
					r =>
						`-----BEGIN PUBLIC KEY-----\n${r.publicKey}\n-----END PUBLIC KEY-----\n`
				)
		);

		const dynamoTable = new aws.dynamodb.Table(
			`${name}-dynamodb`,
			{
				attributes: [
					{
						name: 'id',
						type: 'S',
					},
					{
						name: 'when',
						type: 'S',
					},
				],
				billingMode: 'PAY_PER_REQUEST',
				hashKey: 'id',
				rangeKey: 'when',
			},
			{ parent: this, protect: args.protectDatabases }
		);

		const grievancesTable = new aws.dynamodb.Table(
			`${name}-grievances`,
			{
				attributes: [
					{
						name: 'id',
						type: 'S',
					},
				],
				billingMode: 'PAY_PER_REQUEST',
				hashKey: 'id',
			},
			{ parent: this, protect: args.protectDatabases }
		);

		const analyticsTable = new aws.dynamodb.Table(
			`${name}-analytics`,
			{
				attributes: [
					{
						name: 'id',
						type: 'S',
					},
					{
						name: 'when',
						type: 'S',
					},
					{
						name: 'feed',
						type: 'S',
					},
				],
				billingMode: 'PAY_PER_REQUEST',
				globalSecondaryIndexes: [
					{
						hashKey: 'feed',
						name: 'feed-when-index',
						projectionType: 'ALL',
						rangeKey: 'when',
					},
				],
				hashKey: 'id',
				rangeKey: 'when',
			},
			{ parent: this, protect: args.protectDatabases }
		);

		const usersTable = new aws.dynamodb.Table(
			`${name}-users`,
			{
				attributes: [
					{
						name: 'id',
						type: 'S',
					},
					{
						name: 'when',
						type: 'S',
					},
				],
				billingMode: 'PAY_PER_REQUEST',
				hashKey: 'id',
				rangeKey: 'when',
			},
			{ parent: this, protect: args.protectDatabases }
		);

		const keyRequestsTable = new aws.dynamodb.Table(
			`${name}-callbox-key`,
			{
				attributes: [
					{
						name: 'id',
						type: 'S',
					},
					{
						name: 'when',
						type: 'S',
					},
				],
				billingMode: 'PAY_PER_REQUEST',
				hashKey: 'id',
				rangeKey: 'when',
			},
			{ parent: this, protect: args.protectDatabases }
		);

		const journalTable = new aws.dynamodb.Table(
			`${name}-journal`,
			{
				attributes: [
					{ name: 'id', type: 'S' },
					{ name: 'when', type: 'S' },
				],
				billingMode: 'PAY_PER_REQUEST',
				hashKey: 'id',
				rangeKey: 'when',
			},
			{ parent: this, protect: args.protectDatabases }
		);

		const journalBucket = new aws.s3.BucketV2(
			deriveBucketName(`${name}-journal-audio`),
			{},
			{ parent: this, protect: args.protectDatabases }
		);

		new aws.s3.BucketServerSideEncryptionConfigurationV2(
			`${name}-journal-audio-encryption`,
			{
				bucket: journalBucket.id,
				rules: [
					{
						applyServerSideEncryptionByDefault: {
							sseAlgorithm: 'AES256',
						},
					},
				],
			},
			{ parent: journalBucket }
		);

		new aws.s3.BucketPublicAccessBlock(
			`${name}-journal-audio-public-access`,
			{
				bucket: journalBucket.id,
				blockPublicAcls: true,
				blockPublicPolicy: true,
				ignorePublicAcls: true,
				restrictPublicBuckets: true,
			},
			{ parent: journalBucket }
		);

		new aws.s3.BucketVersioningV2(
			`${name}-journal-versioning`,
			{
				bucket: journalBucket.id,
				versioningConfiguration: { status: 'Enabled' },
			},
			{ parent: journalBucket }
		);

		new aws.s3.BucketCorsConfigurationV2(
			`${name}-journal-cors`,
			{
				bucket: journalBucket.id,
				corsRules: [
					{
						allowedHeaders: ['content-type', 'if-none-match'],
						allowedMethods: ['PUT'],
						allowedOrigins: [
							'https://zemn.me',
							'https://staging.zemn.me',
							'http://localhost:3000',
						],
						exposeHeaders: ['etag'],
						maxAgeSeconds: 300,
					},
				],
			},
			{ parent: journalBucket }
		);

		const lambdaRole = new aws.iam.Role(
			`${name}-lambda-role`,
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'lambda.amazonaws.com',
				}),
				managedPolicyArns: [
					aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
				],
				inlinePolicies: [
					{
						name: `${name}-dynamodb-inline-policy`,
						policy: Pulumi.all([
							dynamoTable.arn,
							analyticsTable.arn,
							grievancesTable.arn,
							usersTable.arn,
							keyRequestsTable.arn,
							journalTable.arn,
						]).apply(
							([
								settingsArn,
								analyticsArn,
								grievancesArn,
								usersArn,
								keyArn,
								journalArn,
							]) =>
								JSON.stringify({
									Version: '2012-10-17',
									Statement: [
										{
											Action: [
												'dynamodb:Query',
												'dynamodb:PutItem',
												'dynamodb:UpdateItem',
												'dynamodb:DeleteItem',
												'dynamodb:GetItem',
												'dynamodb:Scan',
											],
											Effect: 'Allow',
											Resource: [
												settingsArn,
												analyticsArn,
												`${analyticsArn}/index/*`,
												grievancesArn,
												usersArn,
												keyArn,
												journalArn,
											],
										},
									],
								})
						),
					},
					{
						name: `${name}-journal-audio-inline-policy`,
						policy: journalBucket.arn.apply(arn =>
							JSON.stringify({
								Version: '2012-10-17',
								Statement: [
									{
										Action: [
											's3:GetObject',
											's3:PutObject',
										],
										Effect: 'Allow',
										Resource: `${arn}/*`,
									},
								],
							})
						),
					},
					{
						name: `${name}-kms-inline-policy`,
						policy: oidcKey.arn.apply(arn =>
							JSON.stringify({
								Version: '2012-10-17',
								Statement: [
									{
										Action: ['kms:Sign'],
										Effect: 'Allow',
										Resource: arn,
									},
								],
							})
						),
					},
					...(args.minecraftRconBridgeFunctionArn === undefined
						? []
						: [
								{
									name: `${name}-minecraft-rcon-inline-policy`,
									policy: Pulumi.output(
										args.minecraftRconBridgeFunctionArn
									).apply(arn =>
										JSON.stringify({
											Version: '2012-10-17',
											Statement: [
												{
													Action: [
														'lambda:InvokeFunction',
													],
													Effect: 'Allow',
													Resource: arn,
												},
											],
										})
									),
								},
							]),
					...(args.minecraftWakeFunctionArn === undefined
						? []
						: [
								{
									name: `${name}-minecraft-wake-inline-policy`,
									policy: Pulumi.output(
										args.minecraftWakeFunctionArn
									).apply(arn =>
										JSON.stringify({
											Version: '2012-10-17',
											Statement: [
												{
													Action: [
														'lambda:InvokeFunction',
													],
													Effect: 'Allow',
													Resource: arn,
												},
											],
										})
									),
								},
							]),
					...(args.minecraftLogGroupArn === undefined
						? []
						: [
								{
									name: `${name}-minecraft-logs-inline-policy`,
									policy: Pulumi.output(
										args.minecraftLogGroupArn
									).apply(arn =>
										JSON.stringify({
											Version: '2012-10-17',
											Statement: [
												{
													Action: [
														'logs:DescribeLogStreams',
														'logs:FilterLogEvents',
													],
													Effect: 'Allow',
													Resource: [
														arn,
														`${arn}:log-stream:*`,
													],
												},
											],
										})
									),
								},
							]),
				],
			},
			{ parent: this }
		);

		const journalWorkerRole = new aws.iam.Role(
			`${name}-journal-worker-role`,
			{
				name: `${name}-journal-worker`,
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'lambda.amazonaws.com',
				}),
				managedPolicyArns: [
					aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
				],
				inlinePolicies: [
					{
						name: `${name}-journal-worker-dynamodb-policy`,
						policy: journalTable.arn.apply(arn =>
							JSON.stringify({
								Version: '2012-10-17',
								Statement: [
									{
										Action: [
											'dynamodb:Query',
											'dynamodb:PutItem',
											'dynamodb:UpdateItem',
											'dynamodb:DeleteItem',
											'dynamodb:GetItem',
											'dynamodb:Scan',
										],
										Effect: 'Allow',
										Resource: arn,
									},
								],
							})
						),
					},
					{
						name: `${name}-journal-worker-audio-policy`,
						policy: journalBucket.arn.apply(arn =>
							JSON.stringify({
								Version: '2012-10-17',
								Statement: [
									{
										Action: [
											's3:GetObject',
											's3:PutObject',
											's3:DeleteObject',
										],
										Effect: 'Allow',
										Resource: `${arn}/*`,
									},
								],
							})
						),
					},
					{
						name: `${name}-journal-worker-openai-identity-policy`,
						policy: JSON.stringify({
							Version: '2012-10-17',
							Statement: [
								{
									Action: 'sts:GetWebIdentityToken',
									Condition: {
										'ForAllValues:StringEquals': {
											'sts:IdentityTokenAudience':
												openAIWorkloadIdentityAudience,
										},
										NumericLessThanEquals: {
											'sts:DurationSeconds': 300,
										},
									},
									Effect: 'Allow',
									Resource: '*',
								},
							],
						}),
					},
				],
			},
			{ parent: this }
		);
		this.journalWorkerRoleArn = journalWorkerRole.arn;

		const repo = new aws.ecr.Repository(
			`${name}_repo`,
			{
				forceDelete: true,
			},
			{ parent: this }
		);

		new aws.ecr.LifecyclePolicy(
			`${name}_repo_lifecycle`,
			{
				repository: repo.name,
				policy: JSON.stringify({
					rules: [
						{
							rulePriority: 1,
							description: 'Keep recent API images',
							selection: {
								tagStatus: 'untagged',
								countType: 'imageCountMoreThan',
								countNumber: 10,
							},
							action: {
								type: 'expire',
							},
						},
					],
				}),
			},
			{ parent: repo }
		);

		const auth = aws.ecr.getAuthorizationToken();

		const imageCacheKey = `${repo.repositoryUrl}`;

		let image = lambdaImageCache.get(imageCacheKey);
		if (!image) {
			image = new ApiZemnMeLambdaImage(
				`apizemnmelambdaimage`,
				{
					repository: repo.repositoryUrl,
					token: auth.then(auth => auth.authorizationToken),
				},
				{ parent: this }
			);
			lambdaImageCache.set(imageCacheKey, image);
		}

		let journalWorkerImage = journalWorkerImageCache.get(imageCacheKey);
		if (!journalWorkerImage) {
			journalWorkerImage = new JournalWorkerLambdaImage(
				`journalworkerlambdaimage`,
				{
					repository: repo.repositoryUrl,
					token: auth.then(value => value.authorizationToken),
				},
				{ parent: this }
			);
			journalWorkerImageCache.set(imageCacheKey, journalWorkerImage);
		}

		const logGroup = new aws.cloudwatch.LogGroup(
			`${name}-log-group`,
			{
				retentionInDays: 14,
			},
			{ parent: this }
		);

		const gateway = new aws.apigatewayv2.Api(
			`${name}-api`,
			{
				protocolType: 'HTTP',
			},
			{ parent: this }
		);

		const PERSONAL_PHONE_NUMBER = process.env['PERSONAL_PHONE_NUMBER'];

		// Pass the DynamoDB table name to your Lambda environment.
		const lambdaFn = new LambdaFunction(
			`apizemnmelambdafunction`,
			{
				packageType: 'Image',
				role: lambdaRole.arn,
				imageUri: image.url,
				timeout: 30,
				memorySize: 512,
				environment: {
					variables: {
						ARE_VARIABLES_ACTUALLY_BEING_SET: 'yes!',
						...(PERSONAL_PHONE_NUMBER !== undefined
							? { PERSONAL_PHONE_NUMBER }
							: {}),
						CALLBOX_PHONE_NUMBER: args.callboxPhoneNumber,
						DYNAMODB_TABLE_NAME: dynamoTable.name,
						ANALYTICS_TABLE_NAME: analyticsTable.name,
						GRIEVANCES_TABLE_NAME: grievancesTable.name,
						USERS_TABLE_NAME: usersTable.name,
						CALLBOX_KEY_TABLE_NAME: keyRequestsTable.name,
						JOURNAL_TABLE_NAME: journalTable.name,
						JOURNAL_BUCKET_NAME: journalBucket.bucket,
						TWILIO_SHARED_SECRET: args.twilioSharedSecret,
						...(args.minecraftRconBridgeFunctionName === undefined
							? {}
							: {
									MINECRAFT_RCON_BRIDGE_FUNCTION_NAME:
										args.minecraftRconBridgeFunctionName,
								}),
						...(args.minecraftServerAddress === undefined
							? {}
							: {
									MINECRAFT_SERVER_ADDRESS:
										args.minecraftServerAddress,
								}),
						...(args.minecraftWakeFunctionName === undefined
							? {}
							: {
									MINECRAFT_WAKE_FUNCTION_NAME:
										args.minecraftWakeFunctionName,
								}),
						...(args.minecraftLogGroupName === undefined
							? {}
							: {
									MINECRAFT_LOG_GROUP_NAME:
										args.minecraftLogGroupName,
								}),
						OIDC_JWT_KMS_KEY_ID: oidcKey.keyId,
						OIDC_JWT_PUBLIC_KEY: oidcPublicKey,
						...pick_env('TWILIO_ACCOUNT_SID'),
						...pick_env('TWILIO_AUTH_TOKEN'),
						...pick_env('TWILIO_API_KEY_SID'),
					},
				},
			},
			{ parent: this }
		).function;

		const journalWorker = new LambdaFunction(
			`journalworkerlambda`,
			{
				packageType: 'Image',
				role: journalWorkerRole.arn,
				imageUri: journalWorkerImage.url,
				timeout: 900,
				memorySize: 1024,
				// Aggregate summaries are read-modify-write projections. Keep uploads
				// serial so an older projection cannot overwrite a newer one.
				reservedConcurrentExecutions: 1,
				environment: {
					variables: {
						JOURNAL_TABLE_NAME: journalTable.name,
						JOURNAL_BUCKET_NAME: journalBucket.bucket,
						...(args.openAIIdentityProviderId === undefined
							? {}
							: {
									OPENAI_IDENTITY_PROVIDER_ID:
										args.openAIIdentityProviderId,
									OPENAI_SERVICE_ACCOUNT_ID:
										args.openAIServiceAccountId,
								}),
					},
				},
			},
			{ parent: this }
		).function;

		const permitJournalBucket = new aws.lambda.Permission(
			`${name}-journal-bucket-permission`,
			{
				action: 'lambda:InvokeFunction',
				function: journalWorker.name,
				principal: 's3.amazonaws.com',
				sourceArn: journalBucket.arn,
				statementId: 'journal-s3-invoke',
			},
			{ parent: this }
		);

		new aws.s3.BucketNotification(
			`${name}-journal-upload-notification`,
			{
				bucket: journalBucket.id,
				lambdaFunctions: [
					{
						lambdaFunctionArn: journalWorker.arn,
						events: ['s3:ObjectCreated:*'],
						filterPrefix: 'entries/',
						filterSuffix: 'source',
					},
				],
			},
			{ parent: journalBucket, dependsOn: permitJournalBucket }
		);

		const journalSummarySchedule = new aws.cloudwatch.EventRule(
			`${name}-journal-summary-schedule`,
			{
				description:
					'Backfill elapsed journal summaries after missed or failed upload processing.',
				scheduleExpression: 'cron(5 * * * ? *)',
			},
			{ parent: this }
		);

		const permitJournalSummarySchedule = new aws.lambda.Permission(
			`${name}-journal-summary-schedule-permission`,
			{
				action: 'lambda:InvokeFunction',
				function: journalWorker.name,
				principal: 'events.amazonaws.com',
				sourceArn: journalSummarySchedule.arn,
				statementId: 'journal-summary-schedule-invoke',
			},
			{ parent: this }
		);

		new aws.cloudwatch.EventTarget(
			`${name}-journal-summary-schedule-target`,
			{
				arn: journalWorker.arn,
				rule: journalSummarySchedule.name,
			},
			{
				parent: journalSummarySchedule,
				dependsOn: permitJournalSummarySchedule,
			}
		);

		const integration = new aws.apigatewayv2.Integration(
			`${name}-integration`,
			{
				apiId: gateway.id,
				integrationType: 'AWS_PROXY',
				integrationUri: lambdaFn.arn,
			},
			{ parent: this }
		);

		new aws.lambda.Permission(
			`zemnmeapipermission`,
			{
				action: 'lambda:InvokeFunction',
				function: lambdaFn.name,
				principal: 'apigateway.amazonaws.com',
				sourceArn: Pulumi.interpolate`${gateway.executionArn}/*/*`,
			},
			{ parent: this }
		);

		new aws.apigatewayv2.Route(
			`${name}-proxy-route`,
			{
				apiId: gateway.id,
				routeKey: '$default',
				target: Pulumi.interpolate`integrations/${integration.id}`,
			},
			{ parent: this }
		);

		new aws.apigatewayv2.Stage(
			`${name}-stage`,
			{
				apiId: gateway.id,
				name: '$default',
				autoDeploy: true,
				accessLogSettings: {
					destinationArn: logGroup.arn,
					format: JSON.stringify({
						requestId: '$context.requestId',
						sourceIp: '$context.identity.sourceIp',
						requestTime: '$context.requestTime',
						httpMethod: '$context.httpMethod',
						routeKey: '$context.routeKey',
						status: '$context.status',
						path: '$context.path',
					}),
				},
			},
			{ parent: this }
		);

		const cert = new Certificate(
			`${name}_cert`,
			{
				zoneId: args.zoneId,
				domain: args.domain,
				noCostAllocationTag: true,
			},
			{ parent: this }
		);

		const customDomain = new aws.apigatewayv2.DomainName(
			`${name}-domain`,
			{
				domainName: args.domain,
				domainNameConfiguration: {
					certificateArn: cert.validation.certificateArn,
					endpointType: 'REGIONAL',
					securityPolicy: 'TLS_1_2',
				},
			},
			{ parent: this }
		);

		new aws.apigatewayv2.ApiMapping(
			`${name}-api-mapping`,
			{
				apiId: gateway.id,
				domainName: customDomain.id,
				stage: '$default',
			},
			{ parent: this }
		);

		new aws.route53.Record(
			`${name}-dns`,
			{
				zoneId: args.zoneId,
				name: args.domain,
				type: 'A',
				aliases: [
					{
						name: customDomain.domainNameConfiguration
							.targetDomainName,
						zoneId: customDomain.domainNameConfiguration
							.hostedZoneId,
						evaluateTargetHealth: false,
					},
				],
			},
			{ parent: this }
		);

		super.registerOutputs({
			lambdaEnvironment: lambdaFn.environment,
			callboxPhoneNumber: args.callboxPhoneNumber,
			dynamoDBTableName: dynamoTable.name,
			grievancesTableName: grievancesTable.name,
			usersTableName: usersTable.name,
			journalTableName: journalTable.name,
			journalBucketName: journalBucket.bucket,
			journalWorkerRoleArn: this.journalWorkerRoleArn,
		});
	}
}
