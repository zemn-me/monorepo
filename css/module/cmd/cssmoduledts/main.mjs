import { readFile, writeFile } from 'node:fs/promises';
import { declaration } from '#root/css/module/cmd/cssmoduledts/lib.mjs';

async function run(args) {
	if (args.length !== 2) {
		throw new Error('usage: cssmoduledts <input.css> <output.d.ts>');
	}

	const [input, output] = args;
	const css = await readFile(input);
	await writeFile(output, declaration(input, css));
}

try {
	await run(process.argv.slice(2));
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
