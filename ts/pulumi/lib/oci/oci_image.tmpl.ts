import { ComponentResource, ComponentResourceOptions, Input, Output } from "@pulumi/pulumi";

import { OCIImage } from "#root/ts/pulumi/lib/oci/image.js";


export interface Args {
	repository: Input<string>
	token?: Input<string | undefined>
}

export class __ClassName extends ComponentResource {
	url: Output<string>
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		this.url = new OCIImage(
			`${name}_oci_image`,
			{
				push: "__PUSH_BIN",
				...args
			},
			{ parent: this }
		).uri;


		super.registerOutputs({ upload: this.url })
	}


}
