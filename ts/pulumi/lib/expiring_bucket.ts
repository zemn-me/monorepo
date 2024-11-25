/**
 * Pulumi component for a bucket that expires files after some time
 * instead of deleting them.
 */

import { ecr, lambda } from "@pulumi/aws";
import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";

import { ExpireOnDeleteImage } from "#root/ts/pulumi/lib/expire_on_delete/lambda/ExpireOnDeleteImage.js";


export interface Args {
	bucketId: string
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

		const fn = new lambda.Function(`${name}_lambda`, {

		}, { parent: this });

	}
}

export interface FileExpirerImageUriArgs {
	repo: Input<string>
}

export class FileExpirerImageUri extends ComponentResource {
	constructor(
		name: string,
		args: FileExpirerImageUriArgs,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:lib:ExpiringBucket', name, args, opts);

		new ExpireOnDeleteImage(
			`${name}_image`,
			{
				repository: args.repo
			},
			{ parent: this }
		)
	}
}
