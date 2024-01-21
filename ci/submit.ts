import { Command, Summarize } from '#//ts/github/actions';
import * as Stack from '#//ts/pulumi/stack';

async function main() {
	const stack = await Stack.production();

	console.log(Command('group')({})('Pulumi stack refresh'));
	const result1 = await stack.refresh({
		logToStdErr: true,
		onOutput: o => console.info(o),
	});

	if (result1.stderr !== '')
		console.log(Command('warning')({})(result1.stderr));
	console.log(Command('endgroup')({})());

	const result2 = await stack.up({
		logToStdErr: true,
		onOutput: o => console.info(o),
	});

	// I believe that if there is an issue pulumi will throw, but
	// I am unsure of this, so I'm also going to check for a non-blank stderr.
	if (result2.stderr !== '')
		console.log(Command('warning')({})(result2.stderr));

	await Summarize(
		[result1.summary.message, result2.summary.message].join('\n')
	);
}

main().catch(e => {
	process.exitCode = 1;
	console.error(e);
});
