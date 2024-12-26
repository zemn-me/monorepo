import { local } from '@pulumi/command';
import { ComponentResource, ComponentResourceOptions, Input, Output, output } from "@pulumi/pulumi";


export interface Args {
	repository: Input<string>
}

export class __ClassName extends ComponentResource {
	url: Output<string>
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		const upload = new local.Command(`${name}_push`, {
			interpreter:
				output(args.repository).apply(repository => [
				"__PUSH_BIN",
				"--repository",
				repository,
			])
		}, { parent: this })

		this.url = upload.stdout


		super.registerOutputs({ upload })
	}


}
