import * as stack from 'ts/pulumi/stack';

async function main() {
	const result = await (await stack.production()).up();

	// I believe that if there is an issue pulumi will throw, but
	// I am unsure of this, so I'm also going to check for a non-blank stderr.

	if (result.stderr !== '') throw new Error(result.stderr);
}

main().catch(e => {
	process.exitCode = 1;
	console.error(e);
});
