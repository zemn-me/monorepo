import { local } from '@pulumi/command';
import { ComponentResource, ComponentResourceOptions, Input, output } from "@pulumi/pulumi";
import { FileAsset } from '@pulumi/pulumi/asset';


export interface Args {
	repository: Input<string>
}

export class __ClassName extends ComponentResource {
	digest: FileAsset
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		this.digest = new FileAsset("_DIGEST_PATH");

		const upload = new local.Command(`${name}_push`, {
			create: output(args.repository).apply(repo => [
				"__PUSH_BIN",
				"--repository",
				repo,
			].join(" "))
		}, { parent: this })


		super.registerOutputs({ upload, digest: this.digest })
	}


}
