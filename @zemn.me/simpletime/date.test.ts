import { SimpleDate as Date } from './date';

// generic
// @ts-expect-error
const x: Date = [99, 99, 99] as const;

// out of range month specifier
// @ts-expect-error
const y: Date = [01, 13, 2020] as const;

// out of range month specifier (short)
// @ts-expect-error
const z: Date = [13, 2020] as const;
const z2: Date = ['dec', 2020] as const;

// out of range date specifier
// @ts-expect-error
const a: Date = [31, 'sep', 2020] as const;
const a2: Date = [30, 'sep', 2020] as const;

// cant have zeros of anything
// @ts-expect-error
const m: Date = [0, 'sep', 2020] as const;
const m2: Date = [1, 'sep', 2020] as const;

// @ts-expect-error
const f: Date = [0, 2020];
const f2: Date = ['jan', 2020];

// @ts-expect-error
const q: Date = [0, 'jan', 2020];
const q2: Date = [1, 'jan', 2020];

// some valid dates
const b: Date = [30, 'sep', 2020] as const;
