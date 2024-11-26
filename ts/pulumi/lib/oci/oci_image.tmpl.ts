import { local } from '@pulumi/command';
import { ComponentResource, ComponentResourceOptions, Input, output } from "@pulumi/pulumi";


export interface Args {
	repository: Input<string>
}

export class __ClassName extends ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		const upload = new local.Command(`${name}_push`, {
			create: output(args.repository).apply(repo => [
				"__PUSH_BIN",
				"--repository",
				repo,
			].join(" "))
		}, { parent: this })


		super.registerOutputs({ upload })
	}


}
