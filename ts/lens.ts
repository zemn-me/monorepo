

export type Lens<S, A> = [
	get: (s: S) => A,
	set: (v: A, s: S) => S
]
