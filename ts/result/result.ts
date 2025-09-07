// model generated code. i dont understand it, but i hope to
// one day.

import {
	Either,
	either,
	is_left,
	is_right,
	Left,
	Right,
} from "ts/either/either"

/**
 * Result<T, E>
 *
 * Internally: Either<E, T>  (error first, success second)
 */
export type Result<T, E> = Either<E, T>

/** Construct a successful Result. */
export const Ok = <T, E = never>(v: T): Result<T, E> => Right<T, E>(v)

export type Ok<T> = Result<never, T>;
export type Err<E> = Result<E, never>;

/** Construct a failed Result. */
export const Err = <E, T = never>(e: E): Result<T, E> => Left<E, T>(e)

/** True if this Result is Ok (success). */
export const is_ok = <T, E>(v: Result<T, E>): boolean => is_right(v)

/** True if this Result is Err (failure). */
export const is_err = <T, E>(v: Result<T, E>): boolean => is_left(v)

/** Get the error value, or throw if this is Ok. */
export function unwrap_err<T, E>(v: Result<T, E>): E {
	return unwrap(either(v, e => Ok(e), () =>
		Err(new Error("Not in error."))
	))
}

/** Get the success value, or throw the error if this is Err. */
export function unwrap<T, E>(v: Result<T, E>): T {
	return either<E, T, T>(v, e => { throw e as unknown }, t => t)
}

/**
 * Get the success value (assumes this is Ok).
 *
 * this used to do no checking but i dont understand church notation enough
 * to make this not check or whatever.
 */
export function unwrap_unsafe<T>(v: Ok<T>): T {
	return unwrap(v)
}

/** Alias for `unwrap_unsafe`. */
export const unwrap_unchecked = unwrap_unsafe

/** Return the success value or a fallback if Err. */
export function unwrap_or<T, TT>(v: Result<T, unknown>, fallback: TT): T | TT {
	return either<unknown, T, T | TT>(v, () => fallback, t => t)
}

/** If Err, call `fallback(e)`; if Ok, pass through unchanged. */
export function or_else<Success, Fail, NewFail>(
	v: Result<Success, Fail>,
	fallback: (e: Fail) => Result<Success, NewFail>
): Result<Success, NewFail> {
	return either<Fail, Success, Result<Success, NewFail>>(
		v,
		fallback,
		t => Ok<Success, NewFail>(t)
	)
}

/** If Err, compute a default from the error; otherwise return the value. */
export function unwrap_or_else<T1, T2, E>(
	v: Result<T1, E>,
	fallback: (e: E) => T2
): T1 | T2 {
	return either<E, T1, T1 | T2>(v, fallback, t => t)
}

/** Chain: if Ok, run `f(value)`; if Err, keep the error. */
export function and_then<T, E, O>(
	v: Result<T, E>,
	f: (value: T) => O
): Result<O, E> {
	return either<E, T, Result<O, E>>(
		v,
		e => Err<E, O>(e),
		t => Ok<O, E>(f(t))
	)
}

/** Flatten nested Results. */
export function flatten<T, E1, E2>(
	v: Result<Result<T, E2>, E1>
): Result<T, E1 | E2> {
	return either<E1, Result<T, E2>, Result<T, E1 | E2>>(
		v,
		e1 => Err<E1 | E2, T>(e1),
		inner => inner as Result<T, E1 | E2>
	)
}

/** Combine two Results; first error wins, else pair the values. */
export function zip<T, TT, E>(
	a: Result<T, E>,
	b: Result<TT, E>
): Result<[T, TT], E> {
	return either<E, T, Result<[T, TT], E>>(
		a,
		e => Err<E, [T, TT]>(e),
		ta =>
			either<E, TT, Result<[T, TT], E>>(
				b,
				e => Err<E, [T, TT]>(e),
				tb => Ok<[T, TT], E>([ta, tb])
			)
	)
}

/** Turn Result<Promise<T>, E> into Promise<Result<T, E>>. */
export async function result_promise_transpose<T, E>(
	r: Result<Promise<T>, E>
): Promise<Result<T, E>> {
	return either<E, Promise<T>, Promise<Result<T, E>>>(
		r,
		async e => Err<E, T>(e),
		async p => Ok<T, E>(await p)
	)
}

/**
 * Collect many Results into a single Result of an array.
 * Stops at the first error.
 */
export function result_collect<T, E>(arr: Result<T, E>[]): Result<T[], E> {
	const out: T[] = []
	for (const res of arr) {
		const next = either<E, T, Result<null, E>>(
			res,
			e => Err<E, null>(e),
			t => { out.push(t); return Ok<null, E>(null) }
		)
		if (is_err(next)) {
			return Err<E, T[]>(unwrap_err(next)) // FIXED: Err<E, T[]>
		}
	}
	return Ok<T[], E>(out)
}

/** If Ok, replace its value with `vv`; if Err, keep the error. */
export function result_and<V, E>(
	v: Result<unknown, E>,
	vv: V
): Result<V, E> {
	return is_ok(v) ? Ok<V, E>(vv) : (v as Result<V, E>)
}
