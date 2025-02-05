import { always, ifElse } from 'ramda';

import { Err, Ok, Result } from '#root/ts/_types.js';
import { isDefined } from '#root/ts/guard.js';

export const _some = Symbol();
export const _none = Symbol();

export type Some<T> = { [_some]: T, [_none]?: undefined }
export type None = { [_none]: true, [_some]?: undefined }
export type Option<T> = Some<T> | None

export const None: None = { [_none]: true };

export function Some<T>(v: T): Some<T> {
	return { [_some]: v }
}

export function is_some<T>(v: Option<T>): v is Some<T> {
	return !is_none(v)
}

export function is_none(v: Option<unknown>): v is None {
	return _none in v
}

export function unwrap<T>(v: Option<T>): T {
	if (is_some(v)) return v[_some];
	throw new Error("Cannot unwrap Option; has no value.");
}

export function unwrap_or<T, T2>(v: Option<T>, fallback: T2): T | T2 {
	if (is_none(v)) return fallback;

	return v[_some]
}

export function unwrap_or_else<T, T2>(v: Option<T>, fallback: () => T2): T | T2 {
	if (is_none(v)) return fallback();

	return v[_some]
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


