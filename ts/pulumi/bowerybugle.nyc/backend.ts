import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { BoweryBugleImage } from '#root/project/nyc/bowerybugle/cmd/api/BoweryBugleImage.js';
import { sanitizeAwsLambdaStatementId } from '#root/ts/pulumi/lib/awsNames.js';
import Certificate from '#root/ts/pulumi/lib/certificate.js';
import { LambdaFunction } from '#root/ts/pulumi/lib/lambda_function.js';

interface Args {
	domain: string;
	zoneId: pulumi.Input<string>;
	staging: boolean;
	tags?: pulumi.Input<Record<string, pulumi.Input<string>>>;
}

export class Backend extends pulumi.ComponentResource {
	readonly domain: string;
	constructor(
		name: string,
		args: Args,
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:bowerybugle:Backend', name, args, opts);
		const child = { parent: this };
		const durable = {
			parent: this,
			protect: !args.staging,
			retainOnDelete: !args.staging,
		};
		const author = 'bowerybugle@gmail.com';
		const origin = `https://${args.domain}`;
		const loginKey = new aws.kms.Key(
			`${name}_login_key`,
			{
				customerMasterKeySpec: 'HMAC_256',
				keyUsage: 'GENERATE_VERIFY_MAC',
				description: 'Bowery Bugle email login seed derivation',
				deletionWindowInDays: 30,
				tags: args.tags,
			},
			durable
		);
		const bucket = new aws.s3.BucketV2(
			`${name}_pdfs`,
			{ tags: args.tags },
			durable
		);
		new aws.s3.BucketPublicAccessBlock(
			`${name}_private`,
			{
				bucket: bucket.id,
				blockPublicAcls: true,
				blockPublicPolicy: true,
				ignorePublicAcls: true,
				restrictPublicBuckets: true,
			},
			child
		);
		const versions = new aws.s3.BucketVersioningV2(
			`${name}_versions`,
			{
				bucket: bucket.id,
				versioningConfiguration: { status: 'Enabled' },
			},
			child
		);
		new aws.s3.BucketServerSideEncryptionConfigurationV2(
			`${name}_encryption`,
			{
				bucket: bucket.id,
				rules: [
					{
						applyServerSideEncryptionByDefault: {
							sseAlgorithm: 'AES256',
						},
					},
				],
			},
			child
		);
		new aws.s3.BucketCorsConfigurationV2(
			`${name}_cors`,
			{
				bucket: bucket.id,
				corsRules: [
					{
						allowedMethods: ['POST'],
						allowedOrigins: [origin],
						allowedHeaders: ['*'],
						maxAgeSeconds: 300,
					},
				],
			},
			child
		);
		const table = new aws.dynamodb.Table(
			`${name}_archive`,
			{
				billingMode: 'PAY_PER_REQUEST',
				hashKey: 'kind',
				rangeKey: 'id',
				attributes: [
					{ name: 'kind', type: 'S' },
					{ name: 'id', type: 'S' },
				],
				ttl: { attributeName: 'expires', enabled: true },
				pointInTimeRecovery: { enabled: !args.staging },
				tags: args.tags,
			},
			durable
		);
		const identity = new aws.ses.DomainIdentity(
			`${name}_sender`,
			{ domain: args.domain },
			child
		);
		const verification = new aws.route53.Record(
			`${name}_sender_verification`,
			{
				zoneId: args.zoneId,
				name: `_amazonses.${args.domain}`,
				type: 'TXT',
				ttl: 300,
				records: [identity.verificationToken],
			},
			child
		);
		const verified = new aws.ses.DomainIdentityVerification(
			`${name}_sender_verified`,
			{ domain: identity.id },
			{ ...child, dependsOn: [verification] }
		);
		const dkim = new aws.ses.DomainDkim(
			`${name}_dkim`,
			{ domain: identity.domain },
			child
		);
		for (let index = 0; index < 3; index++) {
			new aws.route53.Record(
				`${name}_dkim_${index}`,
				{
					zoneId: args.zoneId,
					name: pulumi.interpolate`${dkim.dkimTokens.apply(tokens => tokens[index])}._domainkey.${args.domain}`,
					type: 'CNAME',
					ttl: 300,
					records: [
						dkim.dkimTokens.apply(
							tokens => `${tokens[index]}.dkim.amazonses.com`
						),
					],
				},
				child
			);
		}
		// A single recipient can use SES even in the sandbox after accepting AWS's
		// verification email. Production owns this account-wide email identity.
		if (!args.staging)
			new aws.ses.EmailIdentity(
				`${name}_author`,
				{ email: author },
				child
			);
		const role = new aws.iam.Role(
			`${name}_role`,
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'lambda.amazonaws.com',
				}),
			},
			child
		);
		const policy = new aws.iam.RolePolicy(
			`${name}_permissions`,
			{
				role: role.id,
				policy: pulumi
					.all([table.arn, bucket.arn, identity.arn, loginKey.arn])
					.apply(([tableArn, bucketArn, senderArn, loginKeyArn]) =>
						JSON.stringify({
							Version: '2012-10-17',
							Statement: [
								{
									Effect: 'Allow',
									Action: ['kms:GenerateMac'],
									Resource: loginKeyArn,
								},
								{
									Effect: 'Allow',
									Action: [
										'dynamodb:GetItem',
										'dynamodb:PutItem',
										'dynamodb:DeleteItem',
										'dynamodb:UpdateItem',
										'dynamodb:Query',
									],
									Resource: tableArn,
								},
								{
									Effect: 'Allow',
									Action: [
										's3:PutObject',
										's3:GetObject',
										's3:GetObjectVersion',
									],
									Resource: `${bucketArn}/issues/*`,
								},
								{
									Effect: 'Allow',
									Action: ['ses:SendEmail'],
									Resource: senderArn,
									Condition: {
										'ForAllValues:StringEquals': {
											'ses:Recipients': [author],
										},
									},
								},
							],
						})
					),
			},
			child
		);
		new aws.iam.RolePolicyAttachment(
			`${name}_logs`,
			{
				role: role.name,
				policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
			},
			child
		);
		const repo = new aws.ecr.Repository(
			`${name}_repo`,
			{ forceDelete: args.staging, tags: args.tags },
			child
		);
		const image = new BoweryBugleImage(
			`${name}_image`,
			{
				repository: repo.repositoryUrl,
				token: aws.ecr.getAuthorizationTokenOutput().authorizationToken,
			},
			child
		);
		const fn = new LambdaFunction(
			`${name}_lambda`,
			{
				packageType: 'Image',
				imageUri: image.url,
				role: role.arn,
				timeout: 30,
				memorySize: 256,
				environment: {
					variables: {
						TABLE_NAME: table.name,
						LOGIN_KEY_ID: loginKey.keyId,
						PDF_BUCKET: bucket.bucket,
						SITE_ORIGIN: origin,
						AUTHOR_EMAIL: author,
						MAIL_FROM: `The Bowery Bugle <login@${args.domain}>`,
					},
				},
				tags: args.tags,
			},
			{ ...child, dependsOn: [policy, versions, verified] }
		).function;
		const gateway = new aws.apigatewayv2.Api(
			`${name}_api`,
			{ protocolType: 'HTTP', disableExecuteApiEndpoint: true },
			child
		);
		const integration = new aws.apigatewayv2.Integration(
			`${name}_integration`,
			{
				apiId: gateway.id,
				integrationType: 'AWS_PROXY',
				integrationUri: fn.invokeArn,
				payloadFormatVersion: '2.0',
			},
			child
		);
		new aws.apigatewayv2.Route(
			`${name}_route`,
			{
				apiId: gateway.id,
				routeKey: '$default',
				target: pulumi.interpolate`integrations/${integration.id}`,
			},
			child
		);
		const stage = new aws.apigatewayv2.Stage(
			`${name}_stage`,
			{
				apiId: gateway.id,
				name: '$default',
				autoDeploy: true,
				defaultRouteSettings: {
					throttlingBurstLimit: 20,
					throttlingRateLimit: 10,
				},
			},
			child
		);
		new aws.lambda.Permission(
			`${name}_invoke`,
			{
				action: 'lambda:InvokeFunction',
				function: fn.name,
				principal: 'apigateway.amazonaws.com',
				sourceArn: pulumi.interpolate`${gateway.executionArn}/*/*`,
				statementId: sanitizeAwsLambdaStatementId(`${name}_api`),
			},
			child
		);
		this.domain = `api.${args.domain}`;
		const certificate = new Certificate(
			`${name}_certificate`,
			{
				domain: this.domain,
				zoneId: args.zoneId,
				noCostAllocationTag: true,
				tags: args.tags,
			},
			child
		);
		const domain = new aws.apigatewayv2.DomainName(
			`${name}_domain`,
			{
				domainName: this.domain,
				domainNameConfiguration: {
					certificateArn: certificate.validation.certificateArn,
					endpointType: 'REGIONAL',
					securityPolicy: 'TLS_1_2',
				},
			},
			child
		);
		new aws.apigatewayv2.ApiMapping(
			`${name}_mapping`,
			{ apiId: gateway.id, domainName: domain.id, stage: stage.id },
			child
		);
		new aws.route53.Record(
			`${name}_dns`,
			{
				zoneId: args.zoneId,
				name: this.domain,
				type: 'A',
				aliases: [
					{
						name: domain.domainNameConfiguration.targetDomainName,
						zoneId: domain.domainNameConfiguration.hostedZoneId,
						evaluateTargetHealth: false,
					},
				],
			},
			child
		);
		this.registerOutputs({ domain: this.domain });
	}
}
