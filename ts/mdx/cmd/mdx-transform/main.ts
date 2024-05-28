/* eslint-disable no-console */
/**
 * @fileoverview turn MDX files into tsx files.
 * @see https://v0.mdxjs.com/advanced/transform-content
 */
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import * as mdx from '@mdx-js/mdx';
import { readFile } from 'fs/promises';
import { SourceMapGenerator } from 'source-map';
import { read, write } from 'to-vfile';
import { VFile } from 'vfile';

import { map } from '#root/ts/iter/index.js';
import { zip } from '#root/ts/math/vec.js';

function collect(value: string, previous: string[]) {
  return previous.concat([value]);
}

void new Command('mdx-transform')
	.addHelpText(
		'beforeAll',
		`${
			'Transform a set of MDX files to .tsx files.\n' +
			'\n' +
			'The number of input files and output files must be the same, as' +
			'input files are directly mapped to output files in order.'
		}`
	)
	.requiredOption('--input <file>', `${'Input file(s).'}`, collect, [])
	.requiredOption('--output <file>', `${'Output file(s).'}`, collect, [])
	.action(async o => {
		const { input, output } = o;

		if (typeof input == 'boolean')
			throw new Error('Must provide a value for input');
		if (typeof output == 'boolean')
			throw new Error('Must provide a value for output');

		if (input.length != output.length)
			throw new Error(`Input and output lengths must be the same.`);

		await Promise.all([
			...map(zip(input, output), async ([i, o]) => {
				const js = await mdx.compile(await read(i), {
					SourceMapGenerator: SourceMapGenerator,
				});
				js.path = '../../../' + o;

				js.map!.sourcesContent = [(await readFile(i)).toString()];
				// the source map uses relative paths to the js file
				// but is being generated relative to cwd.
				js.map!.sources = js.map!.sources.map(v => `/${v}`);
				const sourceMap: VFile = new VFile({
					path: `${js.path}.map`,
					value: JSON.stringify(js.map)
				});
				js.value += `//# sourceMappingURL=${path.relative(path.dirname(js.path), sourceMap.path)}`
				await Promise.all([
					await write(js),
					await write(sourceMap)
				]);
			}),
		]);
	})
	.parseAsync(process.argv)
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
