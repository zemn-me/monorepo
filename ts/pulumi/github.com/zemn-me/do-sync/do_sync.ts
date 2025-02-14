import { runfiles } from '@bazel/runfiles';
import * as Pulumi from '@pulumi/pulumi';
import { FileAsset } from '@pulumi/pulumi/asset';

import { Copybara } from '#root/ts/pulumi/lib/copybara/copybara.js';

export interface Args {
	staging: boolean;
	tags?: Pulumi.Input<Record<string, Pulumi.Input<string>>>;
}

export class DoSync extends Pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: Pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lulu.computer', name, args, opts);

		new Copybara(
			`${name}_copybara`,
			{
				config: new FileAsset(
					runfiles.resolve("monorepo/ts/do-sync/copy.bara.sky")
				),
				staging: args.staging,
			},
			{parent: this}
		)
	}
}
