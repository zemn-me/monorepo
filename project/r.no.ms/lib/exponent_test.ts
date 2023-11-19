import * as exponent from 'project/r.no.ms/lib/exponent';

test.each([
	[1_000, '1k'],
	[1_000_000, '1M'],
	[0.1, '1d'],
	[1_000_000_000, '1M'],
])(`exponent.${exponent.si.name}(%d) should be %s`, (a, b) =>
	expect(exponent.si(a)).toEqual(b)
);

test.each([
	[1, 10, '1da'],
	[1, 100, '1h'],
	[1, 1000, '1k'],
])(
	`exponent.${exponent.siWithGivenExponent.name}(%d, %d) should be %s`,
	(a, b, c) => expect(exponent.siWithGivenExponent(a, b)).toEqual(c)
);

describe(`exponent.${exponent.exponentForm.name}`, () => {
	describe.each([
		[1, '0'],
		[10, '1E1'],
		[100, '1E2'],
		[1000, '1E3'],
		[10000, '1E4'],
		[50000, '1E4'],
	])(`(%d) => %s`, (a, b) => {
		const [k, e] = exponent.exponentForm(a);

		test(`${k}*10^${e} === ${a}`, () =>
			expect(k * Math.pow(10, e)).toEqual(a));

		test(`=== ${b}`, () => expect([k, e].join('E')).toEqual(b));
	});
});
