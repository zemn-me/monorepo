import { NewType } from "#root/ts/NewType.js";
import * as types from '#root/ts/result2/types.js';


export class impl<T> extends NewType<T> {
	is_err<T, E>(this: Result<T, E>): this is Err<E> { return types.is_err(this.value) }
	is_ok<T, E>(this: Result<T, E>): this is Ok<T> { return types.is_ok(this.value) }
	unwrap<T, E>(this: Result<T, E>): T { return types.unwrap(this.value) }
	unwrap_or<T, E>(this: Result<T, E>, fallback: T): T { return types.unwrap_or(this.value, fallback) }
	unwrap_err<E>(this: Result<unknown, E>): E {
		if (!this.is_err()) throw new Error("Cannot unwrap non error Result to error.");

		return this.value[types._err];
	}

	unwrap_or_else<T, E>(this: Result<T, E>, fallback: (e: E) => T): T {
		return types.unwrap_or_else(this.value, fallback)
	}
	and_then<T, E, O>(this: Result<T, E>, f: (v: T) => O): Result<O, E> {
		return new impl(types.and_then(this.value, f));
	}
	flatten<T, E1, E2>(this: Result<Result<T, E2>, E1>): Result<T, E1 | E2 > {
		if (this.is_err()) return this;
		return this.unwrap();
	}
	zip<T1, T2, E1, E2>(this: Result<T1, E1>, other: Result<T2, E2>): Result<[T1, T2], E1 | E2> {
		return this.and_then(v => other.and_then(vv => [v, vv ] as [T1, T2])).flatten()
	}
	and<E, V>(this: Result<unknown, E>, v: V): Result<V, E> {
		if (this.is_err()) return this;

		return Ok(v);
	}

	as_union<T, E>(this: Result<T, E>): T | E {
		if (this.is_err()) return this.unwrap_err();
		return this.unwrap();
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
