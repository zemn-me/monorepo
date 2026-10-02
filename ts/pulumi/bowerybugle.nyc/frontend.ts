import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { sanitizeAwsLambdaStatementId } from '#root/ts/pulumi/lib/awsNames.js';
import { LambdaFunction } from '#root/ts/pulumi/lib/lambda_function.js';

export class Frontend extends pulumi.ComponentResource {
	readonly origin: pulumi.Output<string>;
	constructor(
		name: string,
		args: {
			domain: string;
			tags?: pulumi.Input<Record<string, pulumi.Input<string>>>;
		},
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:bowerybugle.nyc:Frontend', name, args, opts);
		const child = { parent: this };
		const role = new aws.iam.Role(
			`${name}_role`,
			{
				assumeRolePolicy: JSON.stringify({
					Version: '2012-10-17',
					Statement: [
						{
							Effect: 'Allow',
							Principal: { Service: 'lambda.amazonaws.com' },
							Action: 'sts:AssumeRole',
						},
					],
				}),
				tags: args.tags,
			},
			child
		);
		const logs = new aws.iam.RolePolicyAttachment(
			`${name}_logs`,
			{
				role: role.name,
				policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
			},
			child
		);
		// The renderer has no storage, mail, or author-session permissions. It reads
		// the same public API as visitors and ships only public data in its HTML.
		const fn = new LambdaFunction(
			`${name}_lambda`,
			{
				runtime: 'nodejs24.x',
				handler: 'handler.handler',
				// Bazel runfiles are symlinks, which directory archives can skip.
				// Explicit file assets preserve the handler in the deployment ZIP.
				code: new pulumi.asset.AssetArchive({
					'handler.mjs': new pulumi.asset.FileAsset(
						'project/nyc/bowerybugle/server_build/handler.mjs'
					),
				}),
				role: role.arn,
				timeout: 15,
				memorySize: 512,
				environment: {
					variables: {
						SITE_ORIGIN: `https://${args.domain}`,
						API_ORIGIN: `https://api.${args.domain}`,
						NODE_ENV: 'production',
					},
				},
				tags: args.tags,
			},
			{ ...child, dependsOn: [logs] }
		).function;
		const gateway = new aws.apigatewayv2.Api(
			`${name}_api`,
			{ protocolType: 'HTTP' },
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
		const route = new aws.apigatewayv2.Route(
			`${name}_route`,
			{
				apiId: gateway.id,
				routeKey: '$default',
				target: pulumi.interpolate`integrations/${integration.id}`,
			},
			child
		);
		const invoke = new aws.lambda.Permission(
			`${name}_invoke`,
			{
				action: 'lambda:InvokeFunction',
				function: fn.name,
				principal: 'apigateway.amazonaws.com',
				sourceArn: pulumi.interpolate`${gateway.executionArn}/*/*`,
				statementId: sanitizeAwsLambdaStatementId(`${name}_invoke`),
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
					throttlingBurstLimit: 50,
					throttlingRateLimit: 25,
				},
			},
			{ ...child, dependsOn: [route, invoke] }
		);
		this.origin = pulumi
			.all([gateway.apiEndpoint, stage.id])
			.apply(([endpoint]) => new URL(endpoint).hostname);
		this.registerOutputs({ origin: this.origin });
	}
}
