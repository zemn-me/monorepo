import child_process from 'node:child_process';

import { Command } from '@commander-js/extra-typings';
import { Command as WorkflowCommand } from 'ts/github/actions';
import deploy_to_staging from 'ts/pulumi/deploy_to_staging';

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
	.option(
		'--dangerously-skip-pnpm-lockfile-validation',
		`${
			'Skip presubmit package.json:pnpm-lock.yaml validation. ' +
			'This is a really dangerous thing to do because it can create a desynchronization ' +
			'that only manifests in some revision down the line.'
		}`
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

		// validate the pnpm lockfile.
		if (!o.dangerouslySkipPnpmLockfileValidation) {
			await Task('Validate the PNPM lockfile.')(
				new Promise<void>((ok, err) =>
					child_process
						.spawn(
							// TODO(zemnmez): this should be changed to be the local bazel
							// version once this issue is fixed:
							// https://github.com/pnpm/pnpm/issues/6962
							'npm',
							[
								'exec',
								'--yes',
								'--package',
								'pnpm@8.6.12',
								'--',
								'pnpm',
								'i',
								'--frozen-lockfile',
								'--lockfile-only',
								// Due to this issue:
								// https://github.com/pnpm/pnpm/issues/6962
								// specifying --dir causes --frozen-lockfile to be ignored.
								/*							'--dir',
							// aspect_rules_js uses this as their example;
							// I think the script might pull in some patches etc
							// so we have to be a bit smarter than just setting
							// cwd when we launch the binary.
							cwd, */
							],
							{
								cwd,
								stdio: 'inherit',
							}
						)
						.on('close', code =>
							code != 0 ? err(`exit ${code}`) : ok()
						)
				)
			);
		}

		if (!o.skipBazelTests) {
			await Task('Run all bazel tests.')(
				new Promise<void>((ok, error) =>
					child_process
						.spawn('bazel', ['test', '//...'], {
							cwd,
							stdio: 'inherit',
						})
						.on('close', code =>
							code !== 0
								? error(new Error(`Exit code ${code}`))
								: ok()
						)
				)
			);
			// perform all the normal tests
		}

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

function logError(e: unknown) {
	if (!(e instanceof Error)) return console.log(e);

	const stack = e.stack ?? Error.prototype.stack;

	if (!stack) return console.log(e);

	const runfilesRoot = process.env['TEST_SRCDIR'];

	if (!runfilesRoot) return console.log(e);

	const runfilesRootIndex = stack.indexOf(runfilesRoot);

	if (runfilesRootIndex == -1) return console.log(e);

	const suffix = stack.slice(runfilesRootIndex + runfilesRoot.length);

	const res = /^([A-Za-z0-9/._]+)\.(?:ts|js):(\d+):(\d+)/.exec(suffix);

	if (res === null) return console.log(e);

	const [, filePrefix, line, offset] = res;

	console.error(
		WorkflowCommand('error')({
			file: filePrefix,
			line: line,
			col: offset,
		})('' + e)
	);
}

cmd.parseAsync(process.argv).catch(e => {
	process.exitCode = 2;
	logError(e);
});
