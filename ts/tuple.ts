export type Tuple<T, N extends number> = N extends N
	? number extends N
		? T[]
		: _TupleOf<T, N, []>
	: never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
	? R
	: _TupleOf<T, N, [T, ...R]>;

 type StringToNumber<S extends string> =
  S extends `${infer N extends number}` ? N : never;


type TupleIndexStrings<N extends number>
	= keyof Omit<
		Tuple<unknown, N>,
		keyof []
	>

export type TupleIndex<N extends number> = TupleIndexStrings<N> extends string ?
	StringToNumber<TupleIndexStrings<N>> : never;
