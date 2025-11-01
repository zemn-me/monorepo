import {
  Either,
  either,
  is_left,
  is_right,
  Left,
  Right,
} from "#root/ts/either/either.js"
import { isDefined } from "#root/ts/guard.js"
import { and_then as result_and_then, Err, Ok, Result, unwrap_or as result_unwrap_or } from "#root/ts/result/result.js"

/**
 * Option<T> ≔ Either<null, T>
 * - None  → Left(null)
 * - Some  → Right(value)
 */
export type Option<T> = Either<null, T>

export const _None = /*#__NO_SIDE_EFFECTS__*/ <T = never>(): Option<T> => Left<null, T>(null)
/** Construct None (no value). */
export const None = /*#__NO_SIDE_EFFECTS__*/ _None();

export type Some<T> = Right<T, null>;
export type None = typeof None; // Left<null>

/** Construct Some(value). */
export const Some = /*#__NO_SIDE_EFFECTS__*/ <T>(v: T): Option<T> => Right<T, null>(v)

/** True if it’s Some. */
export const is_some = /*#__NO_SIDE_EFFECTS__*/ <T>(o: Option<T>) => is_right(o)

/** True if it’s None. */
export const is_none = /*#__NO_SIDE_EFFECTS__*/ <T>(o: Option<T>) => is_left(o)

/** Get the value or throw if None. */
/*#__NO_SIDE_EFFECTS__*/
export function unwrap<T>(o: Option<T>): T {
  return either<null, T, T>(o, () => { throw new Error("Cannot unwrap Option; has no value.") }, v => v)
}

/** Get the value (assumes Some). */
/*#__NO_SIDE_EFFECTS__*/
export function unwrap_unchecked<T>(o: Option<T>): T {
  return either<null, T, T>(o, () => { throw new Error("unwrap_unchecked called on None") }, v => v)
}

/** Get the value or a fallback. */
/*#__NO_SIDE_EFFECTS__*/
export function unwrap_or<T, T2>(o: Option<T>, fallback: T2): T | T2 {
  return either<null, T, T | T2>(o, () => fallback, v => v)
}

/** Get the value or call a fallback. */
/*#__NO_SIDE_EFFECTS__*/
export function unwrap_or_else<T, T2>(o: Option<T>, fallback: () => T2): T | T2 {
  return either<null, T, T | T2>(o, () => fallback(), v => v)
}

/** If Some, apply `f` to the value; if None, keep None. */
/*#__NO_SIDE_EFFECTS__*/
export function and_then<T, O>(o: Option<T>, f: (v: T) => O): Option<O> {
  return either<null, T, Option<O>>(o, () => None, v => Some(f(v)))
}

/** Flatten Option<Option<T>> → Option<T>. */
/*#__NO_SIDE_EFFECTS__*/
export function flatten<T>(o: Option<Option<T>>): Option<T> {
  // FIXED: use eliminator so branches return Option<T>
  return either<null, Option<T>, Option<T>>(o, () => None, x => x)
}

/** If Some, run `f` which returns an Option; otherwise None. */
/*#__NO_SIDE_EFFECTS__*/
export function and_then_flatten<T, O>(o: Option<T>, f: (v: T) => Option<O>): Option<O> {
  return either<null, T, Option<O>>(o, () => None, v => f(v))
}

/** Zip two Options. If both Some, returns Some([a,b]); otherwise None. */
/*#__NO_SIDE_EFFECTS__*/
export function zip<T, TT>(a: Option<T>, b: Option<TT>): Option<[T, TT]> {
  return either<null, T, Option<[T, TT]>>(a,
    () => None,
    va => either<null, TT, Option<[T, TT]>>(b,
      () => None,
      vb => Some<[T, TT]>([va, vb])
    )
  )
}

/** If this Option is Some, replace it with `v`; else keep None. */
/*#__NO_SIDE_EFFECTS__*/
export function and<V>(self: Option<unknown>, v: V): Option<V> {
  return is_some(self) ? Some(v) : None
}

/** Convert Option<T> → Result<T, E> using a provided error for None. */
/*#__NO_SIDE_EFFECTS__*/
export function ok_or<T, E>(self: Option<T>, err: E): Result<T, E> {
  return either<null, T, Result<T, E>>(self, () => Err<E, T>(err), v => Ok<T, E>(v))
}

/** Convert Option<T> → Result<T, E> using a thunk for the error. */
/*#__NO_SIDE_EFFECTS__*/
export function ok_or_else<T, E>(self: Option<T>, err: () => E): Result<T, E> {
  return either<null, T, Result<T, E>>(self, () => Err<E, T>(err()), v => Ok<T, E>(v))
}

/** From possibly-undefined: defined → Some(x), undefined → None. */
/*#__NO_SIDE_EFFECTS__*/
export function from<T>(v: T | undefined): Option<T> {
  return isDefined(v) ? Some(v) : None
}

/**
 * Map Option<Result<T,E>> by applying `f` to the Ok value when present.
 * None stays None; Err stays Err.
 */
/*#__NO_SIDE_EFFECTS__*/
export function option_result_and_then<T, O, E>(
  o: Option<Result<T, E>>,
  f: (v: T) => O
): Option<Result<O, E>> {
  return and_then(o, r => result_and_then<T, E, O>(r, x => f(x)))
}

/**
 * Transpose: Option<Result<T,E>> → Result<Option<T>, E>.
 * - None            → Ok(None())
 * - Some(Err(e))    → Err(e)
 * - Some(Ok(t))     → Ok(Some(t))
 */
/*#__NO_SIDE_EFFECTS__*/
export function option_result_transpose<T, E>(
  o: Option<Result<T, E>>
): Result<Option<T>, E> {
  return either<null, Result<T, E>, Result<Option<T>, E>>(o,
    () => Ok<Option<T>, E>(None),
    // FIXED: callback returns Option<T>; result_and_then wraps it into Ok
    r => result_and_then<T, E, Option<T>>(r, t => Some(t))
  )
}

/** Option<Promise<T>> → Promise<Option<T>>. */
/*#__NO_SIDE_EFFECTS__*/
export async function option_promise_transpose<T>(
  o: Option<Promise<T>>
): Promise<Option<T>> {
  return either<null, Promise<T>, Promise<Option<T>>>(o,
    async () => None,
    async p => Some(await p)
  )
}

export function result_to_option<T>(
	r: Result<T, unknown>
): Option<T> {
	return result_unwrap_or(
		result_and_then(r, v => Some(v)),
		None
	)
}
