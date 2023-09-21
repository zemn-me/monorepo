/**
 * @fileoverview Provisions a bazel remote caching server
 * @see https://bazel.build/remote/caching
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as GitHub from '@pulumi/github';
import * as Pulumi from '@pulumi/pulumi';
import * as random from '@pulumi/random';
import * as Cert from 'ts/pulumi/lib/certificate';

export interface Args {
	/**
	 * The zone to deploy to
	 */
	zoneId: Pulumi.Input<string>;

	domain: string;
}

const bucketSuffix = '-bucket';
const pulumiRandomChars = 7;
const bucketNameMaximumLength = 56 - pulumiRandomChars - bucketSuffix.length;

// bucket has a maximum length of 63 (56 minus the 7 random chars that Pulumi adds)
const deriveAWSRestrictedCanonicalName = (base: string) =>
	[...base.replace(/[^a-z0-9.]/g, '-')]
		.slice(0, bucketNameMaximumLength - 1)
		.join('') + bucketSuffix;

interface DockerFileParams {
	accessKey: string;
	s3Bucket: string;
}

const password_file_name = '.htpasswd';
const monorepo_github_name = 'zemnmez/monorepo';

function DockerFile(params: DockerFileParams) {
	return `
# Use a base image with Bazel and other dependencies
FROM buchgr/bazel-remote-cache:latest

# Set the user and group to 1000:1000
USER 1000:1000

# Set the working directory
WORKDIR /data

# Mount cache directory and AWS configuration from the host
VOLUME /data
VOLUME /aws-config

# Expose ports 9090 and 9092
EXPOSE 9090
EXPOSE 9092

COPY ${password_file_name} ${password_file_name}

# Set the entry point and command
CMD [ \\
	"--s3.auth_method=aws_credentials_file", \\
	"--s3.aws_profile=supercool", \\
	"--s3.secret_access_key=${params.accessKey}", \\
	"--s3.bucket=${params.s3Bucket}", \\
	"--s3.endpoint=s3.us-east-1.amazonaws.com", \\
	"--htpasswd_file=${password_file_name}", \\
	"--max_size", \\
	"5" \\
]


	`;
}

export class BazelRemoteCache extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:bazel_rce:BazelRemoteCache', name, args, opts);

		//
		// Provision the bucket that will contain the bazel cache
		//

		/**
		 * IAM user for the cache service.
		 */
		const iamuser = new aws.iam.User(
			`${name}_iam_user`,
			{
				path: '/system/',
			},
			{ parent: this }
		);

		/**
		 * Access key for the cache service IAM user.
		 */
		const accessKey = new aws.iam.AccessKey(
			`${name}_user_access_key`,
			{
				user: iamuser.name,
			},
			{ parent: this }
		);

		/**
		 * S3 bucket for cache server backend
		 */
		const bucket = new aws.s3.BucketV2(
			deriveAWSRestrictedCanonicalName(name),
			{},
			{
				parent: this,
			}
		);

		/**
		 * Bucket policy that allows the cache service IAM user ( @see iamuser )
		 * to read & write to the cache bucket.
		 */
		const bucketPolicy = new aws.s3.BucketPolicy(
			`${name}_bucket_policy`,
			{
				bucket: bucket.id,
				policy: Pulumi.all([iamuser.arn, bucket.arn]).apply(
					([iamuserarn, bucketArn]) =>
						JSON.stringify({
							Version: '2012-10-17',
							Statement: [
								{
									Effect: 'Allow',
									Action: ['s3:ListBucket'],
									Principal: {
										AWS: iamuserarn,
									},
									Resource: [bucketArn],
								},
								{
									Effect: 'Allow',
									Principal: {
										AWS: iamuserarn,
									},
									Action: ['s3:*Object'], // R/W
									Resource: [`${bucketArn}/*`],
								},
							],
						})
				),
			},
			{ parent: this }
		);

		/**
		 * Username used by the GitHub actions runners to use the cache bucket.
		 */
		const username = new random.RandomPassword(
			`${name}_auth_username`,
			{
				length: 25,
			},
			{ parent: this }
		);

		/**
		 * Password used by the GitHub actions runners to use the cache bucket.
		 */
		const password = new random.RandomPassword(
			`${name}_auth_password`,
			{
				length: 25,
			},
			{ parent: this }
		);

		/**
		 * Content for the htpasswd file (auth for the cache server)
		 */
		const htpasswdFileContent = Pulumi.all([username, password]).apply(
			([username, password]) =>
				`${username.result}:${password.bcryptHash}`
		);

		/**
		 * Temporary directory to contain assets needed for the Docker container.
		 */
		const deployContextDirName = (async () => {
			const target = path.join(os.tmpdir(), 'monorepo-pulumi-deploy');
			const temp = await fs.mkdtemp(target);
			return temp;
		})();

		/**
		 * Promise fulfilled when the password file is written
		 */
		const passwordFile = Pulumi.all([
			deployContextDirName,
			htpasswdFileContent,
		]).apply(([dir, content]) =>
			fs.writeFile(path.join(dir, password_file_name), content)
		);

		/**
		 * Promise to the deploy directory that also ensures its contents are written.
		 */
		const deployContextDir = Pulumi.all([
			deployContextDirName,
			passwordFile,
		]).apply(([dirName]) => dirName);

		/**
		 * Cluster on which the cache service will run
		 */
		const cluster = new aws.ecs.Cluster(
			`${name}_cluster`,
			{},
			{ parent: this }
		);

		/**
		 * Load balancer for the cache service
		 */
		const loadBalancer = new awsx.lb.ApplicationLoadBalancer(
			deriveAWSRestrictedCanonicalName(`${name}_loadbalancer`),
			{},
			{ parent: this }
		);

		/**
		 * Repository to contain the built Docker image.
		 */
		const repo = new awsx.ecr.Repository(
			`${name}_ecr`,
			{ forceDelete: true },
			{ parent: this }
		);

		/**
		 * Content of the Dockerfile needed to turn up this service.
		 */
		const dockerFile = Pulumi.all([bucket.id, accessKey.secret]).apply(
			([bucketId, accessKey]) =>
				DockerFile({ s3Bucket: bucketId, accessKey })
		);

		/**
		 * The built Docker image (uploaded to the repo).
		 */
		const image = new awsx.ecr.Image(
			`${name}_image`,
			{
				repositoryUrl: repo.url,
				dockerfile: dockerFile,
				path: deployContextDir,
			},
			{ parent: this }
		);

		/**
		 * The cache service itself on fargate.
		 */
		const service = new awsx.ecs.FargateService(
			`${name}_service`,
			{
				cluster: cluster.arn,
				// we don't want it accessible outside of TLS
				assignPublicIp: false,
				// if we aren't using the cache for a while, it's cool to turn it down
				desiredCount: 1,
				deploymentMaximumPercent: 100,
				deploymentMinimumHealthyPercent: 0,
				taskDefinitionArgs: {
					container: {
						name: `${name}_container`,
						image: image.imageUri,
						cpu: 128,
						memory: 512,
						essential: true,
						portMappings: [
							{
								containerPort: 80,
								targetGroup: loadBalancer.defaultTargetGroup,
							},
						],
					},
				},
			},
			{ parent: this }
		);

		/**
		 * Get a certificate for the cache server
		 */
		const certReq = new Cert.Certificate(
			`${name}_cert`,
			{
				zoneId: args.zoneId,
				domain: args.domain,
			},
			{ parent: this }
		);

		/**
		 * DomainName for the API TLS proxy server.
		 */
		const apiProxyDomainName = new aws.apigatewayv2.DomainName(
			`${name}_domain_name`,
			{
				domainName: args.domain,
				domainNameConfiguration: {
					certificateArn: certReq.validation.certificateArn,
					endpointType: 'REGIONAL',
					securityPolicy: 'TLS_1_2',
				},
			},
			{ parent: this }
		);

		const record = new aws.route53.Record(`${name}_record`, {
			name: apiProxyDomainName.domainName,
			type: 'A',
			zoneId: args.zoneId,
			aliases: [
				{
					name: apiProxyDomainName.domainNameConfiguration.apply(
						domainNameConfiguration =>
							domainNameConfiguration.targetDomainName
					),
					zoneId: apiProxyDomainName.domainNameConfiguration.apply(
						domainNameConfiguration =>
							domainNameConfiguration.hostedZoneId
					),
					evaluateTargetHealth: false,
				},
			],
		});

		/**
		 * Proxy API to pipe the cache server through an encrypted reverse-proxy.
		 */
		const api = new aws.apigatewayv2.Api(
			`${name}_api_proxy`,
			{
				protocolType: 'HTTP',
				disableExecuteApiEndpoint: true,
			},
			{ parent: this }
		);

		/**
		 * Stage for the API gateway that applies the SSL cert.
		 */
		const apiStage = new aws.apigatewayv2.Stage(
			`${name}_proxy_api_gateway_stage`,
			{
				apiId: api.id,
			},
			{ parent: this }
		);

		new aws.apigatewayv2.ApiMapping(
			`${name}_api_mapping`,
			{
				apiId: api.id,
				domainName: apiProxyDomainName.id,
				stage: apiStage.id,
			},
			{ parent: this }
		);

		/**
		 * Proxy integration that proxies the private cache server ELB
		 */
		const integration = new aws.apigatewayv2.Integration(
			`${name}_proxy_integration`,
			{
				apiId: api.id,
				integrationType: 'HTTP_PROXY',
				integrationMethod: 'ANY',
				// proxy the load balancer for the cache service
				integrationUri: loadBalancer.loadBalancer.arn,
			},
			{ parent: this }
		);

		/**
		 * Route that wildcard proxies everything to the integration
		 */
		const apiProxyRoute = new aws.apigatewayv2.Route(
			`${name}_api_proxy_route`,
			{
				apiId: api.id,
				routeKey: 'ANY {proxy+}',
				// what is this syntax lol
				target: Pulumi.interpolate`integrations/${integration.id}`,
			},
			{ parent: this }
		);

		/**
		 * Reverse-proxy to serve SSL certificate on the cache server.
		 */
		new aws.apigatewayv2.Deployment(
			`${name}_gateway_deployment`,
			{
				apiId: api.id,
				description: `SSL / TLS API gateway to the ${args.domain} bazel cache api.`,
			},
			{
				parent: this,
				// **Note:** Creating a deployment for an API requires at least one `aws.apigatewayv2.Route`
				// resource associated with that API. To avoid race conditions when all resources are being
				// created together, you need to add implicit resource references via the `triggers` argument
				// or explicit resource references using the
				// [resource `dependsOn` meta-argument](https://www.pulumi.com/docs/intro/concepts/programming-model/#dependson).
				dependsOn: [apiProxyRoute],
			}
		);

		/**
		 * Get a handle on the monorepo itself.
		 */
		const monorepo = GitHub.getRepository(
			{
				fullName: monorepo_github_name,
			},
			{ parent: this }
		);

		new GitHub.ActionsSecret(
			`${name}_actions_secret_cache_url`,
			{
				plaintextValue: Pulumi.interpolate`https://${username.result}:${password.result}@${record.name}`,
				repository: monorepo.then(v => v.name),
				secretName: 'BAZEL_REMOTE_CACHE_URL',
			},
			{ parent: this }
		);

		super.registerOutputs({ service, bucketPolicy });
	}
}
