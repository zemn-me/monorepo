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

		const username_arg = output(args.username).apply(username => username ? ["--username", `${username}`] : []);

		const password_arg = output(args.password).apply(password => password ? ["--password", `${password}`] : []);

		const repository_arg = output(args.repository).apply(repository => ["--repository", `${repository}`]);

		const arg = all([username_arg, password_arg, repository_arg]).apply(args => args.flat());

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
