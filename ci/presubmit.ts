import child_process from 'node:child_process';

async function main() {
	await child_process.spawn('bazel', ['test', '//...']);
}

main().catch(e => {
	process.exitCode = 2;
	console.error(e);
});
