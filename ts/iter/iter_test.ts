import * as iter from 'ts/iter';

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
