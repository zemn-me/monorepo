import * as iter from 'ts/iter';
import Immutable from 'immutable';

describe('reduce', () => {
	test('sum', () => {
		expect(iter.reduce([1, 2, 3], (p, c) => p + c, 0)).toEqual(6);
	});
});

describe('fromEntries', () => {
	test('simple', () => {
		expect(
			iter.dict.fromEntries([
				['ok', 'cool'],
				['hi', true],
			] as Iterable<[string, string | boolean]>)
		).toEqual({
			ok: 'cool',
			hi: true,
		});
	});
});

test('permute', () => {
	expect([...iter.permute(Immutable.Set([1, 2]))].sort()).toEqual(
		[
			[1, 2],
			[2, 1],
		].sort()
	);

	expect([...iter.permute(Immutable.Set([1, 2, 3]))].sort()).toEqual(
		[
			[1, 3],
			[2, 1],
			[3, 1],
			[2, 3],
			[3, 2],
			[1, 2],
		].sort()
	);
});
