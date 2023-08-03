import child_process from 'node:child_process';

import deploy_to_staging from 'ts/pulumi/deploy_to_staging';

async function main() {
	const skipBazelTests = process.argv.some(v => v == '--skip-bazel-tests');
	const dirty = process.argv.some(v => v == '--dirty');

	if (skipBazelTests) console.log("Skipping presubmit bazel tests...");
	if (dirty) console.log("Leaving staging infrastructure up!")

	// this is unfortunately necessary because my arm mac chokes on getting a running
	// version of inkscape, and I'm deferring solving that to some later day.
	if (!skipBazelTests) {
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
	await deploy_to_staging({ doNotTearDown: dirty });
}

main().catch(e => {
	process.exitCode = 2;
	console.error(e);
});
