import { bazelWithGithubAnnotations } from '#root/ts/bazel/github/index.js';

async function main() {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		// eslint-disable-next-line no-console
		console.error('Usage: bazel_github -- <bazel args>');
		process.exit(2);
	}

	await bazelWithGithubAnnotations(args);
}

main().catch(error => {
	// eslint-disable-next-line no-console
	console.error(error);
	process.exit(1);
});
