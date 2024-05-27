/* eslint-disable no-console */
/**
 * @fileoverview turn MDX files into tsx files.
 * @see https://v0.mdxjs.com/advanced/transform-content
 */
import { Command } from '@commander-js/extra-typings';
import * as mdx from '@mdx-js/mdx';
import { readFile, writeFile } from 'fs/promises';
import { RawSourceMap, SourceMapGenerator } from 'source-map';
import { read, write } from 'to-vfile';

import { map } from '#root/ts/iter/index.js';
import { zip } from '#root/ts/math/vec.js';

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
	.requiredOption('--input <file>', `${'Input file(s).'}`, undefined)
	.requiredOption('--output <file>', `${'Output file(s).'}`, undefined)
	.action(async o => {
		const { input, output } = o;

		if (typeof input == 'boolean')
			throw new Error('Must provide a value for input');
		if (typeof output == 'boolean')
			throw new Error('Must provide a value for output');

		const inputList = typeof input == 'string' ? [input] : input;
		const outputList = typeof output == 'string' ? [output] : output;

		if (inputList.length != outputList.length)
			throw new Error(`Input and output lengths must be the same.`);

		await Promise.all([
			...map(zip(inputList, outputList), async ([i, o]) => {
				const vfile = await mdx.compile(await read(i), {
					SourceMapGenerator: SourceMapGenerator,
				});
				vfile.path = '../../../' + o;
				const map: RawSourceMap = vfile.map!;
				map.sourcesContent = [(await readFile(i)).toString()];
				await Promise.all([
					await write(vfile),
					await writeFile(
						vfile.path + '.map',
						JSON.stringify(vfile.map)
					),
				]);
			}),
		]);
	})
	.parseAsync(process.argv)
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
