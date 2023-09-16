/**
 * @fileoverview Provisions a bazel remote caching server
 * @see https://bazel.build/remote/caching
 */
import * as Pulumi from '@pulumi/pulumi';
import * as awsx from '@pulumi/awsx';
import * as aws from '@pulumi/aws';

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

export class BazelRemoteCache extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:bazel_rce:BazelRemoteCache', name, args, opts);

		const cluster = new aws.ecs.Cluster(`${name}_cluster`, {}, { parent: this });
		const loadBalancer = new awsx.lb.ApplicationLoadBalancer(`${name}_loadbalancer`, {}, { parent: this });

		const repo = new awsx.ecr.Repository(`${name}_ecr`, { forceDelete: true }, { parent: this });

		const image = new awsx.ecr.Image(`${name}_image`, {
			repositoryUrl: repo.url,
			path: "ts/pulumi/bazel_rce",
		}, { parent: this });


			const bucket = new aws.s3.BucketV2(
			deriveBucketName(name),
			{},
			{
				parent: this,
			}
		);






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


}
