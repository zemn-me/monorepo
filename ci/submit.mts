import * as stack from 'monorepo/ts/pulumi/stack.js';

async function main() {
	const result = await (
		await stack.production()
	).up({ logToStdErr: true, onOutput: o => console.info(o) });

	// I believe that if there is an issue pulumi will throw, but
	// I am unsure of this, so I'm also going to check for a non-blank stderr.

	if (result.stderr !== '') throw new Error(result.stderr);
}

main().catch(e => {
	process.exitCode = 1;
	console.error(e);
});
