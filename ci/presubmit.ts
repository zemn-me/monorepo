import child_process from 'node:child_process';

async function main() {
	const cwd = process.env['BUILD_WORKING_DIRECTORY'] ?? process.cwd();
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

main().catch(e => {
	process.exitCode = 2;
	console.error(e);
});
