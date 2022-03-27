import * as iter from './util';

describe('iter', () => {
	test('.fromEntries', () => {
		expect(iter.fromEntries(['k', 'v'], ['k2', 'v2'])).toEqual({
			k: 'v',
			k2: 'v2',
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
