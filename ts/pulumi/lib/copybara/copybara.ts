
import { local } from '@pulumi/command';
import { ComponentResource, ComponentResourceOptions, Input, output } from "@pulumi/pulumi";

import { copybaraBin } from '#root/ts/cmd/copybara/copybara.js';
import { isDefined, must } from '#root/ts/guard.js';


export interface CopybaraArgs {
	args?: Input<string[]>
	configPath: Input<string>
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

		if (!args.staging) {
			const upload = new local.Command(`${name}_run`, {
				environment: {
					GITHUB_TOKEN: must(isDefined)(process.env["GITHUB_TOKEN"])
				},
				interpreter: output(args.args ?? []).apply(a => [
					copybaraBin,
					args.configPath,
					...a
				]),
			}, { parent: this });

			this.registerOutputs({ upload });
		}

	}
}
