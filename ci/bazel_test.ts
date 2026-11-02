import { expect, test } from '@jest/globals';

import * as bazel from '#root/ci/bazel.js';

const later = <T>(): [(value: T | PromiseLike<T>) => void, Promise<T>] => {
	let okay: (value: T | PromiseLike<T>) => void;
	const p = new Promise<T>(ok => (okay = ok));

	return [okay!, p];
};

async function toArray<T>(i: AsyncIterable<T>): Promise<T[]> {
	const arr: T[] = [];
	for await (const v of i) arr.push(v);
	return arr;
}

const shimIterable = async function* <T>(
	v: Iterable<Promise<T>>
): AsyncGenerator<T> {
	for (const vv of v) {
		yield await vv;
	}
};

test('interleave', async () => {
	const [sendA, promiseA] = later<string>();
	const [sendB, promiseB] = later<string>();
	const [sendC, promiseC] = later<string>();
	const [sendD, promiseD] = later<string>();
	const [sendE, promiseE] = later<string>();
	const [sendF, promiseF] = later<string>();

	const r = bazel.interleave(
		shimIterable([promiseA, promiseB, promiseC]),
		shimIterable([promiseD, promiseE, promiseF])
	);

	setImmediate(() => sendA('H'));
	setImmediate(() => sendD('E'));
	setImmediate(() => sendB('L'));
	setImmediate(() => sendC('L'));
	setImmediate(() => sendE('O'));
	setImmediate(() => sendF('!'));

	await expect(toArray(r).then(v => v.join(''))).resolves.toEqual('HELLO!');
});
