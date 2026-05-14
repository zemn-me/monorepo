type MustNumber<T> = T extends number ? T : never;

export type IsNonNegativeInteger<N extends number> = number extends N
	? false
	: `${N}` extends `-${string}`
		? false
		: `${N}` extends `${bigint}`
			? true
			: false;

export type BuildTuple<
	N extends number,
	Acc extends unknown[] = [],
> = IsNonNegativeInteger<N> extends true
	? Acc['length'] extends N
		? Acc
		: BuildTuple<N, [...Acc, unknown]>
	: never;

export type Add<A extends number, B extends number> = number extends A | B
	? number
	: IsNonNegativeInteger<A> extends true
		? IsNonNegativeInteger<B> extends true
			? MustNumber<[...BuildTuple<A>, ...BuildTuple<B>]['length']>
			: never
		: never;

export type LessThan<A extends number, B extends number> = number extends A | B
	? boolean
	: IsNonNegativeInteger<A> extends true
		? IsNonNegativeInteger<B> extends true
			? BuildTuple<A> extends [...BuildTuple<B>, ...infer _Rest]
				? false
				: true
			: never
		: never;

export type Subtract<
	A extends number,
	B extends number,
> = number extends A | B
	? number
	: IsNonNegativeInteger<A> extends true
		? IsNonNegativeInteger<B> extends true
			? BuildTuple<A> extends [...BuildTuple<B>, ...infer Rest]
				? Rest['length']
				: never
			: never
		: never;

type MultiplyImpl<
	A extends number,
	B extends number,
	Counter extends unknown[] = [],
	Acc extends unknown[] = [],
> = Counter['length'] extends B
	? Acc['length']
	: MultiplyImpl<A, B, [...Counter, unknown], [...Acc, ...BuildTuple<A>]>;

export type Multiply<A extends number, B extends number> = number extends A | B
	? number
	: IsNonNegativeInteger<A> extends true
		? IsNonNegativeInteger<B> extends true
			? MustNumber<MultiplyImpl<A, B>>
			: never
		: never;

type DivideFloorImpl<
	A extends number,
	B extends number,
	Quotient extends unknown[] = [],
> = A extends 0
	? Quotient['length']
	: LessThan<A, B> extends true
		? Quotient['length']
		: DivideFloorImpl<Subtract<A, B>, B, [...Quotient, unknown]>;

export type DivideFloor<
	A extends number,
	B extends number,
> = number extends A | B
	? number
	: IsNonNegativeInteger<A> extends true
		? IsNonNegativeInteger<B> extends true
			? B extends 0
				? never
				: DivideFloorImpl<A, B>
			: never
		: never;
