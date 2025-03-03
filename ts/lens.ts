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
