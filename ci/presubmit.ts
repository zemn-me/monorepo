import child_process from 'node:child_process';
import util from 'node:util';

async function main() {
    const cwd = process.env["BUILD_WORKING_DIRECTORY"] ?? process.cwd();
	await util.promisify(child_process.execFile)('bazel', ['test', '//...'], {
        cwd
    });
}

main().catch(e => {
	process.exitCode = 2;
	console.error(e);
});
