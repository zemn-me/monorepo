import fs from 'node:fs';
import * as path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import { Image, ImageArgs } from "@pulumi/awsx/ecr/index.js";
import { ComponentResource, ComponentResourceOptions } from "@pulumi/pulumi";


export interface Args {
	image: Omit<ImageArgs, 'dockerfile'>
}

/*
function listFilesRecursiveSync(dir: string): string[] {
  const dirEntries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];

  dirEntries.forEach(entry => {
    const fullPath = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(listFilesRecursiveSync(fullPath));
    } else {
      files.push(fullPath);
    }
  });

  return files;
}
  */


export class __ClassName extends ComponentResource {
	image: Image
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);



		const dockerfile = path.resolve(runfiles.resolveWorkspaceRelative('__DOCKERFILE_PATH'));

		// eslint-disable-next-line no-console
		console.log("DOCKERFILE IS AT", dockerfile)

		fs.accessSync(dockerfile)


		this.image = new Image(`${name}_image`, {
			platform: "linux/amd64",
			dockerfile,
			...args.image
		}, { parent: this })


		super.registerOutputs({ image: this.image, dockerfile })
	}


}
