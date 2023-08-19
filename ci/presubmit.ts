import child_process from 'node:child_process';

import { Command } from '@commander-js/extra-typings';
import deploy_to_staging from 'ts/pulumi/deploy_to_staging';

const cmd = new Command('presubmit')
	.option(
		'--skip-bazel-tests',
		`${
			'Skip doing the traditional (and very important!) bazel presubmit tests. ' +
			'Typically this is just useful for testing pulumi deploys.' +
			"Skips the other tests that wouldn't fit into bazel, also."
		}`,
		false
	)
	.option(
		'--dirty',
		`${
			'Do not tear down the staging environment after deploy completion. ' +
			"I'm still in two minds about if this should be the case or not."
		}`,
		false
	)
	.option(
		'--skip-pulumi-deploy',
		`${
			'Skip doing the pulumi deploy once bazel testing is completed. ' +
			'This is used for GitHub concurrency groups (since only one deploy may happen at a time).'
		}`,
		false
	)
	.action(async o => {
		// this is unfortunately necessary because my arm mac chokes on getting a running
		// version of inkscape, and I'm deferring solving that to some later day.
		if (!o.skipBazelTests) {
			const cwd = process.env['BUILD_WORKING_DIRECTORY'] ?? process.cwd();
			// perform all the normal tests
			/*
			const p = child_process.spawn('bazel', ['test', '//...'], {
				cwd,
				stdio: 'inherit',
			});

			await new Promise<void>((ok, error) =>
				p.on('close', code => {
					if (code != 0) return error(new Error(`Exit code ${code}`));
					return ok();
				})
			);
			*/

			// validate the pnpm lockfile.
			await new Promise<void>((ok, err) =>
				child_process
					.spawn(
						'npm',
						[
							'exec',
							'--yes',
							// https://github.com/pnpm/pnpm/issues/6962
							'pnpm@8.6.12',
							'i',
							'--frozen-lockfile',
							'--lockfile-only',
							'--dir',
							// aspect_rules_js uses this as their example;
							// I think the script might pull in some patches etc
							// so we have to be a bit smarter than just setting
							// cwd when we launch the binary.
							cwd,
						],
						{
							stdio: 'inherit',
						}
					)
					.on('close', code =>
						code != 0 ? err(`exit ${code}`) : ok()
					)
			);
		}

		// attempt a deploy of pulumi to staging, and tear it down.
		if (!o.skipPulumiDeploy) {
			await deploy_to_staging({ doNotTearDown: o.dirty });
		}
	});

cmd.parseAsync(process.argv).catch(e => {
	process.exitCode = 2;
	console.error(e);
});
