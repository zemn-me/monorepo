import { Tuple } from "#root/ts/tuple.js";


type MustNumber<T> = T extends number ?
	T : never;



export type Add<
	A extends number,
	B extends number
> = MustNumber<[
	...Tuple<unknown, A>,
	...Tuple<unknown, B>
]["length"]>;
