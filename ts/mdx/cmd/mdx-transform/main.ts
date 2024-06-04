/* eslint-disable no-console */
/**
 * @fileoverview turn MDX files into tsx files.
 * @see https://v0.mdxjs.com/advanced/transform-content
 */
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import * as mdx from '@mdx-js/mdx';
import { readFile } from 'fs/promises';
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
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
	.requiredOption('--output-js <file>', `${'Output javascript file(s).'}`, collect, [])
	.requiredOption('--output-map <file>', `${'Output source map file(s).'}`, collect, [])
	.action(async o => {
		const { input, outputJs, outputMap } = o;

		if (![input, outputJs, outputMap].every(v => v.length == input.length))
			throw new Error("there must be the same number of output JS and map files as input JS files.");

		await Promise.all([
			...map(map(zip(zip(input, outputJs), outputMap), ([[i, j] = [], m]) =>
				// each of these must be defined since all 3 arraysmust be same length.
				[i!, j!, m!] as [string, string, string]), async ([input, jsFile, mapFile]) => {

				const js = await mdx.compile(await read(input), {
					SourceMapGenerator: SourceMapGenerator,
					remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
				});

				js.path = jsFile;

				js.map!.sourcesContent = [(await readFile(input)).toString()];
				// the source map uses relative paths to the js file
				// but is being generated relative to cwd.
				js.map!.sources = js.map!.sources.map(v => `/${v}`);
				const sourceMap: VFile = new VFile({
					path: mapFile,
					value: JSON.stringify(js.map)
				});
				js.value += `//# sourceMappingURL=${path.relative(path.dirname(js.path), sourceMap.path)}`
				await Promise.all([
					write(js),
					write(sourceMap)
				]);
			}),
		]);
	})
	.parseAsync(process.argv)
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
