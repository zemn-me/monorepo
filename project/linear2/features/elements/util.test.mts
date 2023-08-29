import * as iter from './util';

describe('iter', () => {
	test('.fromEntries', () => {
		expect(iter.fromEntries(['k', 'v'], ['k2', 'v2'])).toEqual({
			k: 'v',
			k2: 'v2',
		});
	});

	describe('.filter', () => {
		test.each([
			[(i: number): i is 4 => i == 4, [1, 2, 3, 4, 4], [4, 4]],
			[(i: number): i is 4 => i == 4, [], []],
			[
				(i: string | undefined): i is string => i != undefined,
				['ok', undefined],
				['ok'],
			],
		])('(%p) %p => %p', (f: any, i: any, o: any) => {
			expect([...iter.filter(i, f)]).toEqual(o);
		});
	});

	describe('.uniq', () => {
		test.each([
			[
				[1, 2, 3, 4],
				[1, 2, 3, 4],
			],
			[[], []],
		])('%p => %p', (i, o) => {
			expect([...iter.uniq(i)]).toEqual(o);
		});
	});

	describe('.classes', () => {
		it('should glue some classes', () => {
			expect(iter.classes('a', 'b', 'c')).toEqual({
				className: 'a b c',
			});
		});

		it('should not duplicate classes', () => {
			expect(iter.classes('a', 'a', 'b', 'a', 'c')).toEqual({
				className: 'a b c',
			});
		});

		it('should reduce to nothing if there are no classes', () => {
			expect(iter.classes()).toEqual({});
		});

		it('should ignore undefined classes', () => {
			expect(iter.classes(undefined, 'a')?.className).toEqual('a');
		});
	});
});
