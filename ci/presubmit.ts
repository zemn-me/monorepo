import child_process from 'node:child_process';

import { Command } from '@commander-js/extra-typings';
import deploy_to_staging from 'ts/pulumi/deploy_to_staging';

const cmd = new Command('presubmit')
	.option(
		'--skip-bazel-tests',
		`${
			'Skip doing the traditional (and very important!) bazel presubmit tests. ' +
			'Typically this is just useful for testing pulumi deploys.'
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
