/* eslint-disable no-console */
import child_process from 'node:child_process';

import { Command } from '@commander-js/extra-typings';

import * as Bazel from '#root/ci/bazel.js';
import { Command as WorkflowCommand } from '#root/ts/github/actions/index.js';
import deploy_to_staging from '#root/ts/pulumi/deploy_to_staging.js';

const Task =
	(name: string) =>
	<T>(p: Promise<T>): Promise<T> => {
		console.log(WorkflowCommand('group')({})(name));
		return p.finally(() => console.log(WorkflowCommand('endgroup')({})()));
	};

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
		'--overwrite',
		`${'Tear down the existing Pulumi state before performing Pulumi up.'}`,
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
		const cwd = process.env['BUILD_WORKING_DIRECTORY'];
		if (cwd == undefined)
			throw new Error(
				'This executable is intended to be run from Bazel. ' +
					"If you really want to run it outside of using 'bazel run', please set BUILD_WORKING_DIRECTORY to $PWD."
			);
		console.log('Executing in detected directory', cwd);



		// this is placed first since it builds everything in parallel
		// so serial operations coming after take 0 time to build.
		if (!o.skipBazelTests) {
			await Task('Test all bazel code works.')(
				Bazel.Bazel(
					cwd,
					'query',
					'//...',
					'--noshow_progress',
					'--ui_event_filters=-stdout',
					'--noshow_loading_progress',
				)
			);
			await Task('Run all bazel tests.')(
				Bazel.Bazel(cwd, 'test', '//...', '--keep_going', "--config=ci")
			);
			// perform all the normal tests
		}


		await Task('check if we might need to run go.mod')(
			new Promise<void>((ok, error) =>
				child_process
					.spawn(
						'bazelisk',
						[
							'run',
							'--tool_tag=presubmit',
							// it would be better to use the binary directly in our
							// runfiles, but then the go binary itself has runfiles issues
							// for some reason...

							'//sh/bin:go',
							'mod',
							'tidy',
						],
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
										`Go mod tidy exited with ${code}. This likely means that it needs to be run to add / remove deps.`
									)
								)
					)
			)
		);

		await Task('Gazelle')(
			new Promise<void>((ok, error) =>
				child_process
					.spawn(
						'bazelisk',
						[
							'run',
							'//:gazelle',
							'--tool_tag=presubmit',
							'--',
							'--mode',
							'diff',
							'--strict',
						],
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
										`Gazelle exited with ${code}. This likely means that it needs to be run to fix code.`
									)
								)
					)
			)
		);

		// attempt a deploy of pulumi to staging, and tear it down.
		if (!o.skipPulumiDeploy) {
			await Task('Deploy pulumi to the staging environment.')(
				deploy_to_staging({
					overwrite: o.overwrite,
					doNotTearDown: o.dirty,
				})
			);
		}
	});

cmd.parseAsync(process.argv).catch(e => {
	process.exitCode = 2;
	console.error('Terminal error:', e);
});
