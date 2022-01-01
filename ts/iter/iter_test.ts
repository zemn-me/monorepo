import * as iter from 'ts/iter';

describe('reduce', () => {
	test('sum', () => {
		expect(iter.reduce([1, 2, 3], (p, c) => p + c, 0)).toEqual(6);
	});
});
