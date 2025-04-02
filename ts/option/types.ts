import { always, ifElse } from 'ramda';

import { isDefined } from '#root/ts/guard.js';
import { and_then as result_and_then, Err, Ok, Result } from '#root/ts/result_types.js';

export type Some<T> = { some: T, none?: undefined }
export type None = () => { none: true, some?: undefined }
export type Option<T> = Some<T> | None


// i dont think this actually ever gets called in this scheme...
export function None(): { none: true, some?: undefined} {
	return { none: true }
}

export function Some<T>(v: T): Some<T> {
	return { some: v }
}

export function is_some<T>(v: Option<T>): v is Some<T> {
	return "some" in v
}

export function is_none(v: Option<unknown>): v is None {
	return !is_some(v)
}

export function unwrap<T>(v: Option<T>): T {
	if (!is_some(v)) throw new Error("Cannot unwrap Option; has no value.");

	return unwrap_unchecked(v);
}

export function unwrap_unchecked<T>(v: Some<T>): T {
	return v.some;
}

export function unwrap_or<T, T2>(v: Option<T>, fallback: T2): T | T2 {
	if (is_none(v)) return fallback;

	return unwrap_unchecked(v)
}

export function unwrap_or_else<T, T2>(v: Option<T>, fallback: () => T2): T | T2 {
	if (is_none(v)) return fallback();

	return unwrap_unchecked(v);
}

export function and_then<T, O>(v: Option<T>, f: (v: T) => O): Option<O> {
	if (is_none(v)) return v;

	return Some(f(unwrap(v)))
}

export function flatten<T>(v: Option<Option<T>>): Option<T> {
	if (is_none(v)) return v;
	return unwrap(v);
}

/**
 * For two given {@link Option}s, {@link self} and {@link other},
 * return a new option that is a tuple of both values
 * [{@link T}, {@link TT}], if both values are {@link Some}.
 */
export function zip<T, TT>(self: Option<T>, other: Option<TT>): Option<[T, TT]> {
	return flatten(and_then(
		self,
		v => and_then(
			other,
			vv => [v, vv] as [T, TT]
		)
	))
}

/**
 * If this {@link Option} is {@link Some}thing, swap it out for
 * input value {@link v}.
 */
export function and<V>(self: Option<unknown>, v: V): Option<V> {
	if (is_some(self)) return Some(v);

	return None;
}

/**
 * Converts this {@link Option} into an {@link Result} whose value
 * on success is our inner value {@link T}, or – upon failure –
 * the provided error value {@link err}.
 */
export function ok_or<T, E>(self: Option<T>, err: E): Result<T, E> {
	return unwrap_or_else(
		and_then(
		self,
		v => Ok(v)
	), () => Err(err))
}


/**
 * Convert a union of some value ({@link T}) or undefined
 * into {@link Some}({@link T}) or {@link None}.
 */
export function from<T>(self: T | undefined): Option<T> {
	return ifElse(
		isDefined,
		v => Some(v),
		always(None)
	)(self)
}

/**
 * Converts this {@link Option} into an {@link Result} whose value
 * on success is our inner value {@link T}, or – upon failure –
 * the result of calling provided error function {@link err}().
 */
export function ok_or_else<T, E>(
	self: Option<T>,
	err: () => E
): Result<T, E> {
	return unwrap_or_else(
		and_then(
		self,
		v => Ok(v)
	), always(Err(err())))
}



export function option_result_transpose<T, E>(
	a: Option<Result<T, E>>
): Result<Option<T>, E> {
	return unwrap_or(and_then(
		a,
		r => result_and_then(
			r,
			res => Some(res)
		)
	), Ok(None));
}

// god i miss Into() so much.

export async function option_promise_transpose<T>(
	o: Option<Promise<T>>
): Promise<Option<T>> {
	if (is_none(o)) return None;

	return Some(await unwrap(o));
}
