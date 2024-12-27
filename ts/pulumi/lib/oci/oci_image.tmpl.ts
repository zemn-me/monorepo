import { local } from '@pulumi/command';
import { all, ComponentResource, ComponentResourceOptions, Input, Output, output } from "@pulumi/pulumi";


export interface Args {
	repository: Input<string>
	username?: Input<string>
	password?: Input<string>
}

export class __ClassName extends ComponentResource {
	url: Output<string>
	constructor(
		name: string,
		args: Args,
		opts?: ComponentResourceOptions
	) {
		super('__TYPE', name, args, opts);

		const auth_part = all([args.username, args.password]).apply(
			([username, password]) => username && password
				? `${username}:${password}@`
				: ""
		)

		const arg = all([args.repository, auth_part]).apply(([repo, auth]) => [
			"--repository", `${auth}${repo}`
		])

		const upload = new local.Command(`${name}_push`, {
			interpreter:
				arg.apply(arg => [
				"__PUSH_BIN",
				...arg
			])
		}, { parent: this })

		this.url = upload.stdout


		super.registerOutputs({ upload })
	}


}
