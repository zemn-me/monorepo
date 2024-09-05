/* eslint-disable no-console */
/**
 * @fileoverview turn MDX files into tsx files.
 * @see https://v0.mdxjs.com/advanced/transform-content
 */
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';

import { Command } from '@commander-js/extra-typings';
import * as mdx from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import sectionize from 'remark-sectionize';
import { SourceMapGenerator } from 'source-map';
import { read, write } from 'to-vfile';
import { VFile } from 'vfile';

import { Iterable, map, range } from '#root/ts/iter/index.js';
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
	.requiredOption('--output-d-ts <file>', `${'Output typescript declaration files.'}`, collect, [])
	.requiredOption('--base-d-ts <file>', 'base .d.ts to copy.')
	.action(async o => {
		const { input, outputJs, outputMap, outputDTs } = o;

		if (![input, outputJs, outputMap, outputDTs].every(v => v.length == input.length))
			throw new Error("there must be the same number of output JS and map files as input JS files.");

		const n = input.length;

		return Promise.all(Iterable(range(0, input.length)).map(
			async i => {
				const [inFile, outJs, outMap, outDts] = [
					input[i]!, outputJs[i]!, outputMap[i]!, outputDTs[i]!
				];


				const js = await mdx.compile(await read(inFile), {
					SourceMapGenerator: SourceMapGenerator,
					remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter, sectionize],
				});

				js.path = outJs;

				js.map!.sourcesContent = [(await readFile(inFile)).toString()];
				// the source map uses relative paths to the js file
				// but is being generated relative to cwd.
				js.map!.sources = js.map!.sources.map(v => `/${v}`);
				const sourceMap: VFile = new VFile({
					path: outMap,
					value: JSON.stringify(js.map)
				});
				js.value += `//# sourceMappingURL=${path.relative(path.dirname(js.path), sourceMap.path)}`


				return Promise.all([
					write(js),
					write(sourceMap),
					copyFile(o.baseDTs, outDts)
				]);
			}
		).value).then(v => undefined);
	})
	.parseAsync(process.argv)
	.catch(e => {
		console.error(e);
		process.exit(1);
	});
