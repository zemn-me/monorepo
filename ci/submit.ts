import * as Stack from 'ts/pulumi/stack';

async function main() {
	const stack = await Stack.production();
	const result1 = await stack.refresh({
		logToStdErr: true,
		onOutput: o => console.info(o),
	});

	if (result1.stderr !== '') console.error(result1.stderr)

	const result2 = await stack.up({
		logToStdErr: true,
		onOutput: o => console.info(o),
	});

	// I believe that if there is an issue pulumi will throw, but
	// I am unsure of this, so I'm also going to check for a non-blank stderr.
	if (result2.stderr !== '') console.error(result2.stderr);
}

main().catch(e => {
	process.exitCode = 1;
	console.error(e);
});
