import { NewType } from "#root/ts/NewType.js";
import * as types from '#root/ts/types.js';


export class impl<T> extends NewType<T> {
	is_err<T, E>(this: Result<T, E>): this is Err<E> { return types.is_err(this.value) }
	is_ok<T, E>(this: Result<T, E>): this is Ok<T> { return types.is_ok(this.value) }
	unwrap<T, E>(this: Result<T, E>): T { return types.unwrap(this.value) }
	unwrap_or<T, E>(this: Result<T, E>, fallback: T): T { return types.unwrap_or(this.value, fallback) }
	unwrap_err<E>(this: Result<unknown, E>): E {
		if (!this.is_err()) throw new Error("Cannot unwrap non error Result to error.");

		return this.value[types._err];
	}

	/**
	 * Unwrap a Result into an Error.
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
	 * Unwrap a result into a value.
	 *
	 * Unlike in rust `this` is only allowed
	 * to be a value which has been proven to be
	 * not an Err, so the behavior is well-defined
	 * even if not checked at runtime.
	 */
	unwrap_unchecked<V>(this: Ok<V>): V {
		return this.value[types._ok]
	}

	unwrap_or_else<T1, T2, E>(this: Result<T1, E>, fallback: (e: E) => T2): T1 | T2 {
		return types.unwrap_or_else(this.value, fallback)
	}
	and_then<T, E, O>(this: Result<T, E>, f: (v: T) => O): Result<O, E> {
		return new impl(types.and_then(this.value, f));
	}
	flatten<T, E1, E2>(this: Result<Result<T, E2>, E1>): Result<T, E1 | E2 > {
		if (this.is_ok()) return this.unwrap_unchecked();
		// this is implied
		// but the necessity of the type assertion
		// makes me feel like I did something wrong.
		return (this as Err<E1>);
	}
	zip<T1, T2, E1, E2>(this: Result<T1, E1>, other: Result<T2, E2>): Result<[T1, T2], E1 | E2> {
		return this.and_then(v => other.and_then(vv => [v, vv ] as [T1, T2])).flatten()
	}
	and<E, V>(this: Result<unknown, E>, v: V): Result<V, E> {
		if (this.is_err()) return this;

		return Ok(v);
	}

	as_union<T, E>(this: Result<T, E>): T | E {
		if (this.is_err()) return this.unwrap_err_unchecked();
		return (this as Ok<T>).unwrap_unchecked();
	}

	/**
	 * Returns a promise that will reject if this Result
	 * is in error.
	 */
	as_promise<T, E>(this: Result<T, E>): Promise<T> {
		if (this.is_err()) return Promise.reject(this.unwrap_err_unchecked());

		return Promise.resolve(
			(this as Ok<T>).unwrap_unchecked()
		)
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
