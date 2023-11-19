import * as exponent from 'project/r.no.ms/lib/exponent';

test.each([
	[1_000, '1k'],
	[1_000_000, '1m'],
	[0.1, '1d'],
	[1_000_000_000, '1M'],
])('si rendering', (a, b) => {
	expect(exponent.si(a)).toEqual(b);
});

test.each([
	[1, 10, '1da'],
	[1, 100, '1h'],
	[1, 1000, '1k'],
])('si rendering, specifying exponent', (a, b, c) => {
	expect(exponent.siWithGivenExponent(a, b)).toEqual(c);
});
