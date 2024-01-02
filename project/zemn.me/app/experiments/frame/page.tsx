type Unit = 'mm' | 'in' | 'm' | 'cm';

type Measure<U extends Unit = Unit, N extends number = number> = readonly [
	N,
	U,
];

const measure =
	<N extends number>(n: N) =>
	<U extends Unit>(unit: U): Measure<U, N> =>
		[n, unit] as const;

const frame =
	<_Name extends any>(name: _Name) =>
	<_Width extends Measure>(width: _Width) =>
	<_Height extends any>(height: _Height) => ({ name, width, height });

const data = [
	frame('4in x 6 in')(measure(4)('in'))(measure(6)('in')),
	frame('5in x 7in')(measure(5)('in'))(measure(7)('in')),
	frame('8in x 10in')(measure(8)('in'))(measure(10)('in')),
] as const;
