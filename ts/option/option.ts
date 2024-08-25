import { NewType } from "#root/ts/NewType.js";
import * as types from '#root/ts/option/_types.js';
import { Err, Ok, Result } from "#root/ts/result.js";


class impl<T> extends NewType<T> {
	/**
	 * True if this {@link Option} represents {@link None}.
	 */
	is_none<T>(this: Option<T>): this is None { return types.is_none(this.value) }

	/**
	 * True if this {@link Option} is {@link Some}thing.
	 */
	is_some<T>(this: Option<T>): this is Some<T> { return types.is_some(this.value) }

	/**
	 * If this {@link Option} is {@link Some}thing, return its value; otherwise
	 * throw an error.
	 */
	unwrap<T>(this: Option<T>): T { return types.unwrap(this.value) }

	/**
	 * If this {@link Option} is {@link Some}thing, return its value; otherwise
	 * return the {@link fallback} value.
	 */
	unwrap_or<T1, T2>(this: Option<T1>, fallback: T2): T1 | T2 { return types.unwrap_or(this.value, fallback) }

	/**
	 * If this {@link Option} is {@link Some}thing, return its value; otherwise
	 * return the result of {@link fallback}().
	 */
	unwrap_or_else<T1, T2>(this: Option<T1>, fallback: () => T2): T1 | T2 {
		return types.unwrap_or_else(this.value, fallback)
	}

	/**
	 * If this {@link Option} is {@link Some}thing, perform given operation
	 * {@link f} on it.
	 */
	and_then<T, O>(this: Option<T>, f: (v: T) => O): Option<O> {
		return new impl(types.and_then(this.value, f));
	}

	/**
	 * If this {@link Option} has another Option nested directly in it,
	 * un-nests the options to a single potential value.
	 */
	flatten<T>(this: Option<Option<T>>): Option<T> {
		if (this.is_none()) return None;
		return this.unwrap();
	}

	/**
	 * For two given {@link Option}s, {@link this} and {@link other},
	 * return a new option that is a tuple of both values
	 * [{@link T}, {@link TT}], if both values are {@link Some}.
	 */
	zip<T, TT>(this: Option<T>, other: Option<TT>): Option<[T, TT]> {
		return this.and_then(v => other.and_then(vv => [v, vv ] as [T, TT])).flatten()
	}

	/**
	 * If this {@link Option} is {@link Some}thing, swap it out for
	 * input value {@link v}.
	 */
	and<V>(this: Option<unknown>, v: V): Option<V> {
		if (this.is_some()) return Some(v);

		return None;
	}

	/**
	 * Converts this {@link Option} into an {@link Result} whose value
	 * on success is our inner value {@link T}, or – upon failure –
	 * the provided error value {@link err}.
	 */
	ok_or<T, E>(this: Option<T>, err: E): Result<T, E> {
		if (this.is_none()) return Err( err );
		return Ok(this.unwrap());
	}

	/**
	 * Convert a union of some value ({@link T}) or undefined
	 * into {@link Some}({@link T}) or {@link None}.
	 */
	from<T>(this: Some<T | undefined>): Option<T> {
		const val = this.unwrap();
		return val === undefined? None: Some(val)
	}

	/**
	 * Converts this {@link Option} into an {@link Result} whose value
	 * on success is our inner value {@link T}, or – upon failure –
	 * the result of calling provided error function {@link err}().
	 */
	ok_or_else<T, E>(this: Option<T>, err: () => E): Result<T, E> {
		if (this.is_none()) return Err( err() );
		return Ok(this.unwrap());
	}

	/**
	 * An {@link Option} whose value on success is a {@link Result} whose
	 * value on success is {@link T} is converted into an
	 * {@link Option}<{@link T}> by discarding the inner error, if any.
	 */
	absorb_result<T>(this: Option<Result<T, unknown>>): Option<T> {
		if (this.is_none()) return this;

		const inner = this.unwrap() ;

		if (inner.is_err()) return None;

		return Some(inner.unwrap());
	}

}

/**
 * An {@link Option} representing a value that exists.
 */
export function Some<T>(v: T): Some<T> {
	return new impl(types.Some(v))
}

/**
 * An {@link Option} representing a value that exists.
 */
export type Some<T> = impl<types.Some<T>>

/**
 * An {@link Option} representing a value which does not exist.
 */
export type None = impl<types.None>;

/**
 * A value which can be {@link T}, or nothing.
 */
export type Option<T> = impl<types.Option<T>>

/**
 * A value representing nothing.
 */
export const None: None = new impl(types.None);
