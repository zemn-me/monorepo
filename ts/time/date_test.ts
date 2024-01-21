/* eslint-disable @typescript-eslint/no-unused-vars */

import { SimpleDate as Date } from '#root/ts/time/date.js';

test('date', () => {
	// @ts-expect-error a generic invalid date
	const x: Date = [99, 99, 99] as const;

	// @ts-expect-error month too high
	const y: Date = [1, 13, 2020] as const;

	// @ts-expect-error month too high (short)
	const z: Date = [13, 2020] as const;
	const z2: Date = ['dec', 2020] as const;

	// @ts-expect-error date too high
	const a: Date = [31, 'sep', 2020] as const;
	const a2: Date = [30, 'sep', 2020] as const;

	// @ts-expect-error no zero dates
	const m: Date = [0, 'sep', 2020] as const;
	const m2: Date = [1, 'sep', 2020] as const;

	// @ts-expect-error no zero dates
	const f: Date = [0, 2020];

	const f2: Date = ['jan', 2020];

	// @ts-expect-error no zero dates
	const q: Date = [0, 'jan', 2020];
	const q2: Date = [1, 'jan', 2020];

	// some valid dates
	const b: Date = [30, 'sep', 2020] as const;

	expect(1).toEqual(1);
});
