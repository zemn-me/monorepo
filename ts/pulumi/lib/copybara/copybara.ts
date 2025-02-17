
import { local } from '@pulumi/command';
import { ComponentResource, ComponentResourceOptions, Input, Output, output } from "@pulumi/pulumi";
import { FileAsset } from '@pulumi/pulumi/asset/index.js';

import { copybaraBin } from '#root/ts/cmd/copybara/copybara.js';
import { isDefined, must } from '#root/ts/guard.js';


export interface CopybaraArgs {
	args?: Input<string[]>
	config: Input<FileAsset>
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

		// not best practice, but...
		if (args.staging) return;

		const upload = new local.Command(`${name}_run`, {
			environment: {
				GITHUB_TOKEN: must(isDefined)(process.env["GITHUB_TOKEN"])
			},
			interpreter: output(args.args??[]).apply(a => [
				copybaraBin,
				output(args.config).path,
				...a
			]),
		}, { parent: this });

		this.registerOutputs({ upload });
	}
}
