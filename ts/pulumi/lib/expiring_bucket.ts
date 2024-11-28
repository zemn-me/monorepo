/**
 * Pulumi component for a bucket that expires files after some time
 * instead of deleting them.
 */

import * as fs from 'node:fs/promises';

import { lambda, s3 } from "@pulumi/aws";
import { ComponentResource, ComponentResourceOptions, interpolate, output } from "@pulumi/pulumi";

import { ExpireOnDeleteImage } from "#root/ts/pulumi/lib/expire_on_delete/lambda/ExpireOnDeleteImage.js";


export interface Args {
	bucketId: string
	ECRBaseURI: string
}

/**
 * Expires files after some time instead of deleting them.
 */
export class FileExpirer extends ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:lib:ExpiringBucket', name, args, opts);

		const img = new ExpireOnDeleteImage(`${name}_img`, {
			repository: args.ECRBaseURI
		}, { parent: this });

		const fn = new lambda.Function(`${name}_lambda`, {
			"imageUri": interpolate`${args.ECRBaseURI}@${
				img.digest.path.then(p => output(
				fs.readFile(p)))
			}`
		}, { parent: this });


		new s3.BucketNotification(
			`${name}_bucketnotification`,
			{
				bucket: args.bucketId,
				lambdaFunctions: [
					{
						lambdaFunctionArn: fn.arn,
						events: ["s3:ObjectRemoved:*"],
					}
				]
			},
			{ parent: this}
		)
	}
}

