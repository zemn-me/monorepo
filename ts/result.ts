import * as types from '#root/ts/_types.js';
import { NewType } from "#root/ts/NewType.js";


export class impl<T> extends NewType<T> {
	/**
	 * If this {@link Result} represents a failure ({@link Err}), returns
	 * `true`, otherwise returns `false`.
	 */
	is_err<T, E>(this: Result<T, E>): this is Err<E> { return types.is_err(this.value) }

	/**
	 * If this {@link Result} represents a success ({@link Ok}), returns
	 * `true`, otherwise returns `false`.
	 */
	is_ok<T, E>(this: Result<T, E>): this is Ok<T> { return types.is_ok(this.value) }

	/**
	 * If this {@link Result} represents a success ({@link Ok}), return
	 * the success value, or *throw an error*!
	 */
	unwrap<T, E>(this: Result<T, E>): T { return types.unwrap(this.value) }

	/**
	 * If this {@link Result} represents a success, return the success value.
	 * Otherwise return a fallback value.
	 *
	 * To do this while operating on the error value if there is an error, use
	 * {@link unwrap_or_else}.
	 */
	unwrap_or<T, E>(this: Result<T, E>, fallback: T): T { return types.unwrap_or(this.value, fallback) }

	/**
	 * If this {@link Result} represents an error, return it – otherwise
	 * *throw an error*!
	 */
	unwrap_err<E>(this: Result<unknown, E>): E {
		if (!this.is_err()) throw new Error("Cannot unwrap non error Result to error.");

		return this.value[types._err];
	}

	/**
	 * Unwrap a {@link Result} into an error.
	 *
	 * Unlike in rust, `this` is only allowed
	 * to be a value which has been proven to be
	 * an Err, so the behavior is well-defined
	 * even if not checked at runtime.
	 */
	unwrap_err_unchecked<E>(this: Err<E>): E {
		return this.value[types._err]
	}

	/**
	 * Unwrap a {@link Result} into a value.
	 *
	 * Unlike in rust `this` is only allowed
	 * to be a value which has been proven to be
	 * not an Err, so the behavior is well-defined
	 * even if not checked at runtime.
	 */
	unwrap_unchecked<V>(this: Ok<V>): V {
		return this.value[types._ok]
	}

	/**
	 * If this {@link Result} represents a failure, modify the failure value.
	 */
	unwrap_or_else<T1, T2, E>(this: Result<T1, E>, fallback: (e: E) => T2): T1 | T2 {
		return types.unwrap_or_else(this.value, fallback)
	}

	/**
	 * If this {@link Result} represents a success, modify its value.
	 */
	and_then<T, E, O>(this: Result<T, E>, f: (v: T) => O): Result<O, E> {
		return new impl(types.and_then(this.value, f));
	}

	/**
	 * Transform two nested {@link Result}s into one Result.
	 */
	flatten<T, E1, E2>(this: Result<Result<T, E2>, E1>): Result<T, E1 | E2 > {
		if (this.is_ok()) return this.unwrap_unchecked();
		// this is implied
		// but the necessity of the type assertion
		// makes me feel like I did something wrong.
		return (this as Err<E1>);
	}

	/**
	 * Returns a {@link Result} representing the success or failure of two
	 * conditional
	 * Result values.
	 */
	zip<T1, T2, E1, E2>(this: Result<T1, E1>, other: Result<T2, E2>): Result<[T1, T2], E1 | E2> {
		return this.and_then(v => other.and_then(vv => [v, vv ] as [T1, T2])).flatten()
	}

	/**
	 * If the {@link Result} represents a success, returns the passed value.
	 */
	and<E, V>(this: Result<unknown, E>, v: V): Result<V, E> {
		if (this.is_err()) return this;

		return Ok(v);
	}

	/**
	 * Returns this.{@link unwrap}() on success, or
	 * this.{@link unwrap_err}() on failure.
	 *
	 * Equivalent to this.{@link unwrap_or_else}(e => e).
	 */
	as_union<T, E>(this: Result<T, E>): T | E {
		return this.unwrap_or_else(e => e);
	}

	/**
	 * Returns a promise that will reject if this {@link Result}
	 * is in error.
	 */
	as_promise<T, E>(this: Result<T, E>): Promise<T> {
		if (this.is_err()) return Promise.reject(this.unwrap_err_unchecked());

		return Promise.resolve(
			(this as Ok<T>).unwrap_unchecked()
		)
	}

	/**
	 * Transform an operation that may throw an error into a {@link Result}.
	 */
	safely<T>(this: Ok<() => T>): Result<T, unknown> {
		try {
			return Ok(this.unwrap()())
		} catch (e) {
			return Err(e)
		}
	}
}


export function Ok<T>(v: T): Ok<T> {
	return new impl(types.Ok(v))
}

export type Ok<T> = impl<types.Ok<T>>
export type Err<E> = impl<types.Err<E>>;
export type Result<T, E = Error> = impl<types.Result<T, E>>

export function Err<T>(v: T): Err<T> {
	return new impl(types.Err(v))
}
