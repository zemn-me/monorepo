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

			// test if Gazelle etc would update any of our files.
			// I think (and this would be preferable) it might be possible
			// to move this into a bazel test that depends on every single bzl file.
			//
			// I am not sure exactly how this would work, however, as you cannot query
			// for all files at once in a genrule.
			await new Promise<void>((ok, error) =>
				child_process
					.spawn('go', ['mod', 'tidy'], {
						cwd,
						stdio: 'inherit',
					})
					.on('close', code =>
						code == 0
							? ok()
							: error(
									new Error(
										`Go mod tidy exited with ${code}. This likely means that it needs to be run to add / remove deps.`
									)
							  )
					)
			);

			await new Promise<void>((ok, error) =>
				child_process
					.spawn(
						'bazel',
						['run', '//:gazelle-update-repos', '--', '-diff'],
						{
							cwd,
							stdio: 'inherit',
						}
					)
					.on('close', code =>
						code == 0
							? ok()
							: error(
									new Error(
										`Gazelle update repos exited with ${code}. This likely means that it needs to be run to add / remove repos.`
									)
							  )
					)
			);

			await new Promise<void>((ok, error) =>
				child_process
					.spawn('bazel', ['run', '//:gazelle', '--', '-diff'], {
						cwd,
						stdio: 'inherit',
					})
					.on('close', code =>
						code == 0
							? ok()
							: error(
									new Error(
										`Gazelle exited with ${code}. This likely means that it needs to be run to fix code.`
									)
							  )
					)
			);

			await new Promise<void>((ok, error) =>
				child_process
					.spawn('bazel', ['test', '//...'], {
						cwd,
						stdio: 'inherit',
					})
					.on('close', code =>
						code == 0
							? ok()
							: error(new Error(`Exit code: ${code}`))
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
