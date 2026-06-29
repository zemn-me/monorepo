import { readFile, writeFile } from 'node:fs/promises';
import { declaration } from './lib.js';

async function run(args: readonly string[]): Promise<void> {
	if (args.length !== 2) {
		throw new Error('usage: cssmoduledts <input.css> <output.d.ts>');
	}

	const [input, output] = args as [string, string];
	const css = await readFile(input);
	await writeFile(output, declaration(input, css));
}

try {
	await run(process.argv.slice(2));
} catch (error) {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exit(1);
}
