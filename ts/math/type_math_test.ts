import { describe, expect, test } from '@jest/globals';

import type {
	Add,
	BuildTuple,
	DivideFloor,
	IsNonNegativeInteger,
	LessThan,
	Multiply,
	Subtract,
} from '#root/ts/math/type_math.js';

describe('type math', () => {
	test('identifies non-negative integer literal types', () => {
		const valid: IsNonNegativeInteger<3> = true;
		const negative: IsNonNegativeInteger<-1> = false;
		const decimal: IsNonNegativeInteger<1.5> = false;
		const broad: IsNonNegativeInteger<number> = false;

		expect([valid, negative, decimal, broad]).toEqual([
			true,
			false,
			false,
			false,
		]);
	});

	test('computes arithmetic over number literal types', () => {
		const tupleLength: BuildTuple<3>['length'] = 3;
		const sum: Add<2, 5> = 7;
		const difference: Subtract<9, 4> = 5;
		const product: Multiply<3, 4> = 12;
		const quotient: DivideFloor<10, 3> = 3;
		const less: LessThan<2, 5> = true;
		const notLess: LessThan<5, 5> = false;

		expect([
			tupleLength,
			sum,
			difference,
			product,
			quotient,
			less,
			notLess,
		]).toEqual([3, 7, 5, 12, 3, true, false]);
	});
});
