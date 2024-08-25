import { NewType } from "#root/ts/NewType.js";
import * as types from '#root/ts/option/_types.js';
import { Err, Ok, Result } from "#root/ts/result.js";


class impl<T> extends NewType<T> {
	is_none<T>(this: Option<T>): this is None { return types.is_none(this.value) }
	is_some<T>(this: Option<T>): this is Some<T> { return types.is_some(this.value) }
	unwrap<T>(this: Option<T>): T { return types.unwrap(this.value) }
	unwrap_or<T1, T2>(this: Option<T1>, fallback: T2): T1 | T2 { return types.unwrap_or(this.value, fallback) }
	unwrap_or_else<T1, T2>(this: Option<T1>, fallback: () => T2): T1 | T2 {
		return types.unwrap_or_else(this.value, fallback)
	}
	and_then<T, O>(this: Option<T>, f: (v: T) => O): Option<O> {
		return new impl(types.and_then(this.value, f));
	}
	flatten<T>(this: Option<Option<T>>): Option<T> {
		if (this.is_none()) return None;
		return this.unwrap();
	}
	zip<T, TT>(this: Option<T>, other: Option<TT>): Option<[T, TT]> {
		return this.and_then(v => other.and_then(vv => [v, vv ] as [T, TT])).flatten()
	}
	and<V>(this: Option<unknown>, v: V): Option<V> {
		if (this.is_some()) return Some(v);

		return None;
	}

	ok_or<T, E>(this: Option<T>, err: E): Result<T, E> {
		if (this.is_none()) return Err( err );
		return Ok(this.unwrap());
	}

	from<T>(this: Some<T | undefined>): Option<T> {
		const val = this.unwrap();
		return val === undefined? None: Some(val)
	}

	ok_or_else<T, E>(this: Option<T>, err: () => E): Result<T, E> {
		if (this.is_none()) return Err( err() );
		return Ok(this.unwrap());
	}

	/**
	 * Not in rust. Needed because I can't have Option and Result
	 * mutually dependent so I can't implement Result.ok()
	 *
	 * Absorbs the inner result, discarding its error, if any.
	 */
	absorb_result<T>(this: Option<Result<T, unknown>>): Option<T> {
		if (this.is_none()) return this;

		const inner = this.unwrap() ;

		if (inner.is_err()) return None;

		return Some(inner.unwrap());
	}

}

export function Some<T>(v: T): Some<T> {
	return new impl(types.Some(v))
}

export type Some<T> = impl<types.Some<T>>
export type None = impl<types.None>;
export type Option<T> = impl<types.Option<T>>
export const None: None = new impl(types.None);
