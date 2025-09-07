import {
	Either,
	either,
	is_left,
	is_right,
	Left,
	Right,
} from "#root/ts/either/either.js"

/** Result<T, E> ≡ Either<E, T> (error first, success second) */
export type Result<T, E> = Either<E, T>

/** Constructors */
export const Ok = <T, E = never>(v: T): Result<T, E> => Right<T, E>(v)
export const Err = <E, T = never>(e: E): Result<T, E> => Left<E, T>(e)

/** Compatibility aliases (types) — corrected */
export type Ok<T> = Result<T, never>
export type Err<E> = Result<never, E>

/** Predicates */
export const is_ok = <T, E>(v: Result<T, E>) => is_right(v)
export const is_err = <T, E>(v: Result<T, E>) => is_left(v)

/** Left value or throw if Ok */
export function unwrap_err<T, E>(v: Result<T, E>): E {
	return either<E, T, E>(v, e => e, () => { throw new Error("Not in error.") })
}

/** Right value or throw the error */
export function unwrap<T, E>(v: Result<T, E>): T {
	return either<E, T, T>(v, e => { throw e as unknown }, t => t)
}

/** Assume Ok (will throw if actually Err) */
export function unwrap_unsafe<T>(v: Ok<T>): T {
	return unwrap(v)
}
export const unwrap_unchecked = unwrap_unsafe

// this used to actually not check but now i am not sure that is even poss
export const unwrap_err_unchecked = unwrap_err


/** Right value or fallback */
export function unwrap_or<T, TT>(v: Result<T, unknown>, fallback: TT): T | TT {
	return either<unknown, T, T | TT>(v, () => fallback, t => t)
}

/** If Err, map error to a new Result; else pass through */
export function or_else<S, F, NF>(
	v: Result<S, F>,
	fallback: (e: F) => Result<S, NF>
): Result<S, NF> {
	return either<F, S, Result<S, NF>>(v, fallback, s => Ok<S, NF>(s))
}

/** If Err, compute default; else value */
export function unwrap_or_else<T1, T2, E>(
	v: Result<T1, E>,
	fallback: (e: E) => T2
): T1 | T2 {
	return either<E, T1, T1 | T2>(v, fallback, t => t)
}

/** Chain on Ok; keep Err */
export function and_then<T, E, O>(
	v: Result<T, E>,
	f: (value: T) => O
): Result<O, E> {
	return either<E, T, Result<O, E>>(v, e => Err<E, O>(e), t => Ok<O, E>(f(t)))
}

/** Flatten Result<Result<T,E2>,E1> → Result<T, E1|E2> */
export function flatten<T, E1, E2>(
	v: Result<Result<T, E2>, E1>
): Result<T, E1 | E2> {
	return either<E1, Result<T, E2>, Result<T, E1 | E2>>(
		v,
		e1 => Err<E1 | E2, T>(e1),
		inner => inner as Result<T, E1 | E2>
	)
}

/** Zip two Results (first Err wins) */
export function zip<T, TT, E>(
	a: Result<T, E>,
	b: Result<TT, E>
): Result<[T, TT], E> {
	return either<E, T, Result<[T, TT], E>>(
		a,
		e => Err<E, [T, TT]>(e),
		ta => either<E, TT, Result<[T, TT], E>>(
			b,
			e => Err<E, [T, TT]>(e),
			tb => Ok<[T, TT], E>([ta, tb])
		)
	)
}

/** Result<Promise<T>,E> → Promise<Result<T,E>> */
export async function result_promise_transpose<T, E>(
	r: Result<Promise<T>, E>
): Promise<Result<T, E>> {
	return either<E, Promise<T>, Promise<Result<T, E>>>(
		r,
		async e => Err<E, T>(e),
		async p => Ok<T, E>(await p)
	)
}

/** Collect array of Results; stop at first Err */
export function result_collect<T, E>(arr: Result<T, E>[]): Result<T[], E> {
	const out: T[] = []
	for (const res of arr) {
		const next = either<E, T, Result<null, E>>(
			res,
			e => Err<E, null>(e),
			t => { out.push(t); return Ok<null, E>(null) }
		)
		if (is_err(next)) return Err<E, T[]>(unwrap_err(next))
	}
	return Ok<T[], E>(out)
}

/** If Ok, replace value with vv; else keep Err */
export function result_and<V, E>(
	v: Result<unknown, E>,
	vv: V
): Result<V, E> {
	return is_ok(v) ? Ok<V, E>(vv) : (v as Result<V, E>)
}
