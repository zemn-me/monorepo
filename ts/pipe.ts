export function pipe<A>(value: A): A;
export function pipe<A, B>(value: A, fn1: (input: A) => B): B;
export function pipe<A, B, C>(
	value: A,
	fn1: (input: A) => B,
	fn2: (input: B) => C,
): C;
export function pipe<A, B, C, D>(
	value: A,
	fn1: (input: A) => B,
	fn2: (input: B) => C,
	fn3: (input: C) => D,
): D;
export function pipe<A, B, C, D, E>(
	value: A,
	fn1: (input: A) => B,
	fn2: (input: B) => C,
	fn3: (input: C) => D,
	fn4: (input: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
	value: A,
	fn1: (input: A) => B,
	fn2: (input: B) => C,
	fn3: (input: C) => D,
	fn4: (input: D) => E,
	fn5: (input: E) => F,
): F;
export function pipe(
	value: unknown,
	...fns: Array<(input: unknown) => unknown>
): unknown {
	return fns.reduce((acc, fn) => fn(acc), value);
}
