import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from '@jest/globals';

import { walk } from '#root/ts/fs/index.js';
import { unroll } from '#root/ts/iter/index.js';

it('walks the root, nested directories, and every file', async () => {
	const root = await mkdtemp(
		path.join(process.env['TEST_TMPDIR'] ?? tmpdir(), 'walk-')
	);
	try {
		await mkdir(path.join(root, 'nested'));
		await writeFile(path.join(root, 'a.txt'), 'first');
		await writeFile(path.join(root, 'nested', 'b.txt'), 'second');

		const entries = await unroll(walk(root));
		const paths = entries
			.map(([, getPath]) => path.relative(root, getPath()))
			.sort();

		expect(paths).toEqual([
			'',
			'a.txt',
			'nested',
			path.join('nested', 'b.txt'),
		]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
