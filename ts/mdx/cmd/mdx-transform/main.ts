/**
 * @fileoverview turn MDX files into tsx files.
 * @see https://v0.mdxjs.com/advanced/transform-content
 */
import { Command } from '@commander-js/extra-typings';
import { remark } from 'remark';
import mdx from 'remark-mdx';
import { read, write } from 'to-vfile';
import { map } from 'ts/iter';
import { zip } from 'ts/math/vec';

new Command('mdx-transform')
	.addHelpText(
		'beforeAll',
		`${
			'Transform a set of MDX files to .tsx files.\n' +
			'\n' +
			'The number of input files and output files must be the same, as' +
			'input files are directly mapped to output files in order.'
		}`
	)
	.requiredOption('--input', `${'Input file(s).'}`, undefined)
	.requiredOption('--output', `${'Output file(s).'}`, undefined)
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
			...map(zip(inputList, outputList), async ([i, o]) =>
				write({
					contents: remark()
						.use(mdx)
						.process(await read(i)),
					path: o,
				})
			),
		]);
	});
