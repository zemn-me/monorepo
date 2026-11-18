import { expect, test } from '@jest/globals';

import { byLine } from '#root/ci/lines/index.js';

async function toArray<T>(i: AsyncIterable<T>): Promise<T[]> {
	const arr: T[] = [];
	for await (const value of i) arr.push(value);
	return arr;
}

test('byLine preserves split diagnostics without duplicating old fragments', async () => {
	const chunks = async function* () {
		yield Buffer.from('starting\nErr');
		yield Buffer.from('or: broken\r');
		yield Buffer.from('\n\nnext');
		yield Buffer.from(' line\nlast');
	};
	await expect(toArray(byLine(chunks()))).resolves.toEqual([
		'starting', 'Error: broken', '', 'next line', 'last',
	]);
});

test('byLine decodes UTF-8 characters split across chunks', async () => {
	const bytes = Buffer.from('error: café\n');
	const chunks = async function* () {
		for (const byte of bytes) yield Buffer.from([byte]);
	};
	await expect(toArray(byLine(chunks()))).resolves.toEqual(['error: café']);
});
