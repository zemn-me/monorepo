export type Lens<S, A> = [
	get: (s: S) => A,
	set: (v: A, s: S) => S
];

export function LensGet<S, A>(lens: Lens<S, A>) {
	return lens[0]
}

export function LensSet<S, A>(lens: Lens<S, A>) {
	return lens[1]
}

/**
 * An adaptor that does a no-op Promise so an unpromised lense result can
 * be used where a promise would be.
 */
export function lensPromise<S, A>(lens: Lens<S, A>): Lens<Promise<S>, Promise<A>> {
	return [
		/** get */ async s => Promise.resolve(LensGet(lens)(await s)),
		/** set */ async (a, b) => LensSet(lens)(await a, await b)
	]
}
