import fs from 'node:fs';
import path from 'node:path';

export class ParsingFileError extends Error {
	override name = 'ParsingFileError';
	constructor(
		public parent: Error,
		public file: string
	) {
		super(`parsing file: ${file}: ${parent}`);
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeShallow(onto: any, source: any): any {
	for (const [key, value] of Object.entries(source)) {
		if (value instanceof Array) {
			if (onto[key] === undefined) {
				onto[key] = [];
			} else if (!(onto[key] instanceof Array)) {
				throw new Error(
					`mergeShallow: key ${key} in onto is not Array, but is in source`
				);
			}

			onto[key] = [...onto[key], ...value];

			continue;
		}

		if (onto[key] === undefined) {
			onto[key] = {};
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		for (const [key2, value2] of Object.entries(value as any)) {
			if (key2 in onto) {
				throw new Error(
					`mergeShallow: collision! ${key}.${key2} is present in both source and destination!`
				);
			}

			onto[key2] = value2;
		}
	}

	return onto;
}

// takes a set of not-really-json files and merges them shallowly
async function Main(files = process.argv.slice(2)) {
	// hackily determine if we are in the weird rules_js runtime
	files = files.map(file =>
		file.startsWith('bazel-out') ? path.join('../../../', file) : file
	);
	if (files.length == 0) {
		throw new Error('no files provided');
	}

	const output: Record<string, unknown> = {};
	for (const file of files) {
		const content = (
			await fs.promises.readFile(file, { encoding: 'utf-8' })
		).replace(/\r?\n/gm, '');

		if (content.trim() === '') continue;
		const code = `(${content})`;
		try {
			mergeShallow(output, eval(code));
		} catch (e) {
			throw new ParsingFileError(
				e instanceof Error ? e : new Error(`${e}`),
				file
			);
		}
	}

	console.log(JSON.stringify(output, null, 2));
}

Main().catch(e => {
	console.error(e);

	process.exitCode = process.exitCode || 1;
});
