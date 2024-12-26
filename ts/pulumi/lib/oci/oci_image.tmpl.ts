import { local } from '@pulumi/command';
import { ComponentResource, ComponentResourceOptions, Input, output } from "@pulumi/pulumi";


export interface Args {
	repository: Input<string>
}

export class __ClassName extends ComponentResource {
	url: string = "TODO" // will fill once i've deployed for the first time
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		const upload = new local.Command(`${name}_push`, {
			create:
				output(args.repository).apply(repository => [
				"__PUSH_BIN",
				"--repository",
				repository,
			].join(" "))
		}, { parent: this })


		super.registerOutputs({ upload })
	}


}
