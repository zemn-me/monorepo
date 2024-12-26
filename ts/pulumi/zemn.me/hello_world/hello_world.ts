import { ecs } from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { ComponentResource, ComponentResourceOptions, interpolate } from "@pulumi/pulumi";

import { mergeTags, TagSet, tagTrue } from "#root/ts/pulumi/lib/tags.js";
import { HelloWorldImage } from '#root/ts/pulumi/zemn.me/hello_world/HelloWorldImage.js';



export interface Args {
	tags: TagSet
}

export class Component extends ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:Component', name, args, opts);
		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		const cluster = new ecs.Cluster("cluster", {
			tags: tags
		});

		// Create the ECR repository to store our container image
		const repo = new awsx.ecr.Repository("repo", {
			forceDelete: true,
			tags: tags
		});

		// Create a load balancer to listen for requests and route them to the container.
		const loadbalancer = new awsx.lb.ApplicationLoadBalancer("loadbalancer", {});

		const img = new HelloWorldImage(
			`${name}_img`,
			{
				repository: repo.url,
			}
		)

		// Define the service and configure it to use our image and load balancer.
		new awsx.ecs.FargateService("service", {
			cluster: cluster.arn,
			assignPublicIp: true,
			taskDefinitionArgs: {
				container: {
					name: "awsx-ecs",
					image: img.url,
					cpu: 128,
					memory: 512,
					essential: true,
					portMappings: [{
						containerPort: 80,
						targetGroup: loadbalancer.defaultTargetGroup,
					}],
				},
			},
		});

		// Export the URL so we can easily access it.
		const frontendURL = interpolate`http://${loadbalancer.loadBalancer.dnsName}`;

		this.registerOutputs({
			frontendURL: frontendURL,
		});
	}
}
