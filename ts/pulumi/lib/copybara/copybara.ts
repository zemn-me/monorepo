
import { local } from '@pulumi/command';
import { all, ComponentResource, ComponentResourceOptions, Input, output } from "@pulumi/pulumi";

import { copybaraBin } from '#root/ts/cmd/copybara/copybara.js';


export interface CopybaraArgs {
	args?: Input<string[]>
	configPath: Input<string>
	githubToken?: Input<string>
	staging: Input<boolean>
}

export class Copybara extends ComponentResource {
	/**
	 * URI uniquely identifying the image as landed in the repo.
	 */
	constructor(
		name: string,
		args: CopybaraArgs,
		opts?: ComponentResourceOptions
	) {
		super("ts:pulumi:lib:copybara:copybara",
			name, args, opts,
		);

		const interpreterArgs =
			all([output(args.args ?? []), args.configPath]).apply(
				([args, configPath]) => [
					configPath,
					...args
				]
			);
		const interpreter = args.staging ? 'echo' : copybaraBin;

		const interpreterParam = all([interpreter, interpreterArgs]).apply(
			([interpreter, args]) => [
				interpreter,
				...args
			]
		)

		const run = new local.Command(`${name}_run`, {
			environment: output(args.githubToken).apply(
				GITHUB_TOKEN => GITHUB_TOKEN ? { GITHUB_TOKEN } as {
					[key: string]: Input<string>;
				} : {}
			),
			interpreter: interpreterParam,
			triggers: [ Math.random() ]
		}, { parent: this });


		all([run.stdout, run.stderr]).apply(([a, b]) =>
			// eslint-disable-next-line no-console
			console.log(a, b));



	}
}
