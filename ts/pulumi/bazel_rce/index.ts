/**
 * @fileoverview Provisions a bazel remote caching server
 * @see https://bazel.build/remote/caching
 */
import * as Pulumi from '@pulumi/pulumi';
import * as awsx from '@pulumi/awsx';
import * as aws from '@pulumi/aws';
import * as random from '@pulumi/random';
import * as GitHub from '@pulumi/github';

export interface Args {
	/**
	 * The zone to deploy to
	 */
	zoneId: Pulumi.Input<string>;

}

const bucketSuffix = '-bucket';
const pulumiRandomChars = 7;
const bucketNameMaximumLength = 56 - pulumiRandomChars - bucketSuffix.length;

// bucket has a maximum length of 63 (56 minus the 7 random chars that Pulumi adds)
const deriveBucketName = (base: string) =>
	[...base.replace(/[^a-z0-9.]/g, '-')]
		.slice(0, bucketNameMaximumLength - 1)
		.join('') + bucketSuffix;

interface DockerFileParams {
	accessKey: string
	s3Bucket: string
}

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

# Set the entry point and command
CMD [ \\
	"--s3.auth_method=aws_credentials_file", \\
	"--s3.aws_profile=supercool", \\
	"--s3.secret_access_key=${params.accessKey}", \\
	"--s3.bucket=${params.s3Bucket}", \\
	"--s3.endpoint=s3.us-east-1.amazonaws.com", \\
	"--max_size", \\
	"5" \\
]


	`

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

		const iamuser = new aws.iam.User(`${name}_iam_user`, {
			path: "/system/",
		}, { parent: this });

		const accessKey = new aws.iam.AccessKey(`${name}_user_access_key`, { user: iamuser.name });
			const bucket = new aws.s3.BucketV2(
			deriveBucketName(name),
			{},
			{
				parent: this,
			});

		const bucketPolicy = new aws.s3.BucketPolicy(
			`${name}_bucket_policy`,
			{
				bucket: bucket.id,
				policy: Pulumi
					.all([iamuser.arn, bucket.arn])
					.apply(([iamuserarn, bucketArn]) =>
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

		//
		// Create certificate for bazel-remote-cache and the actions runner
		//

		const certificateAuthority = new aws.acmpca.CertificateAuthority(`${name}_certificate_authority`, {
			certificateAuthorityConfiguration: {
				keyAlgorithm: "EC_prime256v1",
				signingAlgorithm: "SHA256WITHECDSA",
				subject:
			}
		}, { parent: this });

		const actionsRunnerCert = new aws.acm.Certificate(
			`${name}_actions_runner_cert`
		);

		//
		// Provision the fargate cluster on which the cache proxy will run
		//

		const cluster = new aws.ecs.Cluster(`${name}_cluster`, {}, { parent: this });
		const loadBalancer = new awsx.lb.ApplicationLoadBalancer(`${name}_loadbalancer`, {}, { parent: this });

		const repo = new awsx.ecr.Repository(`${name}_ecr`, { forceDelete: true }, { parent: this });

		const dockerFile = Pulumi.all([bucket.id, accessKey.secret])
			.apply(([bucketId, accessKey]) => DockerFile({ s3Bucket: bucketId, accessKey }));


		// provisions the configured docker image
		const image = new awsx.ecr.Image(`${name}_image`, {
			repositoryUrl: repo.url,
			dockerfile: dockerFile
		}, { parent: this });


		// deploy a service which uses the predefined docker image
		const service = new awsx.ecs.FargateService(`${name}_service`, {
			cluster: cluster.arn,
			assignPublicIp: true,
			taskDefinitionArgs: {
				container: {
					name: `${name}_container`,
					image: image.imageUri,
					cpu: 128,
					memory: 512,
					essential: true,
					portMappings: [{
						containerPort: 80,
						targetGroup: loadBalancer.defaultTargetGroup
					}]
				}
			}


		});


		// TODO:
		// 	1. Generate a client certificate for the Actions runners via AWS certificate manager.
		//  2. Use the GitHub adaptor to push this secret into the secret set for the monorepo.
}
