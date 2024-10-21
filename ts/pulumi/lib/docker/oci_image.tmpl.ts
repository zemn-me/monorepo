import fs from 'node:fs';

import { runfiles } from '@bazel/runfiles';
import { Image, ImageArgs } from "@pulumi/awsx/ecr/index.js";
import { ComponentResource, ComponentResourceOptions } from "@pulumi/pulumi";


export interface Args {
	image: Omit<ImageArgs, 'dockerfile'>
}

export class __ClassName extends ComponentResource {
	image: Image
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		const dockerfile = runfiles.resolveWorkspaceRelative('__DOCKERFILE_PATH');

		fs.accessSync(dockerfile)


		this.image = new Image(`${name}_image`, {
			platform: "linux/amd64",
			dockerfile,
			...args.image
		}, { parent: this })


		super.registerOutputs({ image: this.image })
	}


}
