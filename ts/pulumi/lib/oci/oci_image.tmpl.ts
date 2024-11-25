import { local } from '@pulumi/command';
import { ComponentResource, ComponentResourceOptions } from "@pulumi/pulumi";


export interface Args {
	repository: string
}

export class __ClassName extends ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		const upload = new local.Command(`${name}_push`, {
			create: [
				"__PUSH_BIN",
				"--repository",
				args.repository,
			].join(" ")
		}, { parent: this })


		super.registerOutputs({ upload })
	}


}
