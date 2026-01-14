import { expect, it, test } from '@jest/globals';

import { annotationsFromBuildEvents, interleave } from '#root/ci/bazel.js';

it('annotates failed test summaries', async () => {
	const { annotations, failures, errorObserved } = annotationsFromBuildEvents([
		{
			id: { testSummary: { label: '//foo:bar' } },
			payload: { testSummary: { overallStatus: 'FAILED' } },
		},
	]);

	expect(annotations).toEqual([
		'::error title=%2F%2Ffoo%3Abar failed,file=foo/BUILD.bazel::%2F%2Ffoo%3Abar FAILED',
	]);
	expect(failures).toEqual(['//foo:bar']);
	expect(errorObserved).toBe(true);
});

it('annotates flaky test summaries as warnings', async () => {
	const { annotations, failures, errorObserved } = annotationsFromBuildEvents([
		{
			id: { testSummary: { label: '//foo:flaky' } },
			payload: { testSummary: { overallStatus: 'FLAKY' } },
		},
	]);

	expect(annotations).toEqual([
		'::warning title=%2F%2Ffoo%3Aflaky flaky,file=foo/BUILD.bazel::%2F%2Ffoo%3Aflaky FLAKY',
	]);
	expect(failures).toEqual([]);
	expect(errorObserved).toBe(false);
});

it('annotates aborted builds', async () => {
	const { annotations, failures, errorObserved } = annotationsFromBuildEvents([
		{
			payload: {
				aborted: { reason: 'INTERNAL', description: 'panic' },
			},
		},
	]);

	expect(annotations).toEqual([
		'::error title=Build aborted %28INTERNAL%29::panic',
	]);
	expect(failures).toEqual([]);
	expect(errorObserved).toBe(true);
});

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

	const r = interleave(
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
