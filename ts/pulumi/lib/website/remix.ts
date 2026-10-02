import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { RandomPassword } from '@pulumi/random';

import {
	sanitizeAwsAlphaNumericHyphenUnderscoreName,
	sanitizeAwsLambdaFunctionName,
	sanitizeAwsLambdaStatementId,
} from '#root/ts/pulumi/lib/awsNames.js';

export interface RemixServerArgs {
	directory: string;
	domain: pulumi.Input<string>;
	tags?: pulumi.Input<Record<string, pulumi.Input<string>>>;
}

function serverArchive(directory: string): pulumi.asset.AssetArchive {
	const assets: Record<string, pulumi.asset.FileAsset> = {};
	function collect(relative: string) {
		for (const name of readdirSync(path.join(directory, relative))) {
			const key = path.posix.join(relative, name);
			const file = path.join(directory, key);
			// Bazel runfiles may symlink both directories and files. Directory
			// FileArchives skip those entries, so enumerate explicit file assets.
			if (statSync(file).isDirectory()) collect(key);
			else assets[key] = new pulumi.asset.FileAsset(file);
		}
	}
	collect('');
	if (!assets['handler.mjs'])
		throw new Error('Remix handler bundle is missing');
	return new pulumi.asset.AssetArchive(assets);
}

/** A buffered Node SSR origin; static assets stay in the website's S3 bucket. */
export class RemixServer extends pulumi.ComponentResource {
	readonly domain: pulumi.Output<string>;
	readonly originSecret: pulumi.Output<string>;
	readonly cachePolicy: aws.cloudfront.CachePolicy;

	constructor(
		name: string,
		args: RemixServerArgs,
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lib:RemixServer', name, args, opts);
		const parent = { parent: this };
		this.originSecret = new RandomPassword(
			`${name}_origin_secret`,
			{ length: 48, special: false },
			parent
		).result;
		const role = new aws.iam.Role(
			`${name}_role`,
			{
				assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
					Service: 'lambda.amazonaws.com',
				}),
				tags: args.tags,
			},
			parent
		);
		const logging = new aws.iam.RolePolicyAttachment(
			`${name}_logging`,
			{
				role: role.name,
				policyArn:
					'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
			},
			parent
		);
		const fn = new aws.lambda.Function(
			sanitizeAwsLambdaFunctionName(name),
			{
				code: serverArchive(args.directory),
				handler: 'handler.handler',
				runtime: 'nodejs24.x',
				architectures: ['arm64'],
				memorySize: 1024,
				timeout: 30,
				role: role.arn,
				environment: {
					variables: {
						NODE_ENV: 'production',
						PUBLIC_ORIGIN: pulumi.interpolate`https://${args.domain}`,
						REMIX_ORIGIN_SECRET: this.originSecret,
					},
				},
				tags: args.tags,
			},
			{ ...parent, dependsOn: [logging] }
		);
		new aws.cloudwatch.LogGroup(
			`${name}_logs`,
			{
				name: pulumi.interpolate`/aws/lambda/${fn.name}`,
				retentionInDays: 30,
				tags: args.tags,
			},
			parent
		);
		const api = new aws.apigatewayv2.Api(
			`${name}_http`,
			{ protocolType: 'HTTP', tags: args.tags },
			parent
		);
		const integration = new aws.apigatewayv2.Integration(
			`${name}_integration`,
			{
				apiId: api.id,
				integrationType: 'AWS_PROXY',
				integrationUri: fn.arn,
				payloadFormatVersion: '2.0',
				timeoutMilliseconds: 29000,
			},
			parent
		);
		const route = new aws.apigatewayv2.Route(
			`${name}_route`,
			{
				apiId: api.id,
				routeKey: '$default',
				target: pulumi.interpolate`integrations/${integration.id}`,
			},
			parent
		);
		const permission = new aws.lambda.Permission(
			`${name}_invoke`,
			{
				statementId: sanitizeAwsLambdaStatementId(`${name}_invoke`),
				action: 'lambda:InvokeFunction',
				function: fn.name,
				principal: 'apigateway.amazonaws.com',
				sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
			},
			parent
		);
		const stage = new aws.apigatewayv2.Stage(
			`${name}_stage`,
			{
				apiId: api.id,
				name: '$default',
				autoDeploy: true,
				tags: args.tags,
			},
			{ ...parent, dependsOn: [route, permission] }
		);
		this.domain = pulumi
			.all([api.apiEndpoint, stage.id])
			.apply(([endpoint]) => new URL(endpoint).hostname);
		this.cachePolicy = new aws.cloudfront.CachePolicy(
			sanitizeAwsAlphaNumericHyphenUnderscoreName(`${name}_cache`),
			{
				// Zero minimum is required for private/no-store to take effect.
				minTtl: 0,
				defaultTtl: 0,
				maxTtl: 86400,
				parametersInCacheKeyAndForwardedToOrigin: {
					cookiesConfig: { cookieBehavior: 'all' },
					queryStringsConfig: { queryStringBehavior: 'all' },
					headersConfig: {
						headerBehavior: 'whitelist',
						headers: {
							items: ['Authorization', 'Accept', 'Origin'],
						},
					},
					enableAcceptEncodingBrotli: true,
					enableAcceptEncodingGzip: true,
				},
			},
			parent
		);
		this.registerOutputs({ domain: this.domain });
	}
}
