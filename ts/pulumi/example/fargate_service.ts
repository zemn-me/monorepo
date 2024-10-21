import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as Pulumi from '@pulumi/pulumi';

import { SimpleGoEcrExample } from '#root/ts/pulumi/lib/docker/testing/example/go/simple_go_example.js'
import { mergeTags, tagTrue } from '#root/ts/pulumi/lib/tags.js';


export interface Args {
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}

export class ExampleFargateService extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:example:ExampleFargateService', name, args, opts);
		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		// in reality i think u are meant to share these.
		const repo = new awsx.ecr.Repository("repo", {
			forceDelete: true,
		});

		const image = new SimpleGoEcrExample(
			`${name}_ecr_container`, {
				image: {
					repositoryUrl: repo.url
				},
			});

		const cluster = new aws.ecs.Cluster(
			`${name}_cluster`,
			{
				tags: tags,
			}
		);

		const loadBalancer = new awsx.lb.ApplicationLoadBalancer(
			`${name}_loadbalancer`,
			{ tags: tags}
		);

		const service = new awsx.ecs.FargateService(
			`${name}_service`,
			{
				tags: tags,
				cluster: cluster.arn,
				assignPublicIp: true,
				taskDefinitionArgs: {
					container: {
						name: `${name}_container`,
						image: image.image.imageUri,
						cpu: 128,
						memory: 512,
						portMappings: [{
							containerPort: 80,
							targetGroup: loadBalancer.defaultTargetGroup
						}]
					}
				}
			}

		)


		super.registerOutputs({
			service
		})

	}
}
