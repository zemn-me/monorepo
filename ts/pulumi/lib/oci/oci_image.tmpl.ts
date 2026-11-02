import { readFile } from 'node:fs/promises';

import {
	ComponentResource,
	ComponentResourceOptions,
	Input,
	Output,
	output,
} from '@pulumi/pulumi';

import { OCIImage } from '#root/ts/pulumi/lib/oci/image.js';

export interface Args {
	repository: Input<string>;
	token?: Input<string | undefined>;
}

export class __ClassName extends ComponentResource {
	url: Output<string>;
	static digestPath: string = '__DIGEST';
	constructor(name: string, args: Args, opts?: ComponentResourceOptions) {
		super('__TYPE', name, args, opts);

		this.url = new OCIImage(
			`${name}_oci_image`,
			{
				push: '__PUSH_BIN',
				digest: output(
					// Pulumi identifies promises with instanceof; normalize Node's
					// promise into this realm when running inside a test VM.
					Promise.resolve(readFile(__ClassName.digestPath)).then(f =>
						f.toString()
					)
				),
				...args,
			},
			{ parent: this }
		).uri;

		super.registerOutputs({ upload: this.url });
	}
}
