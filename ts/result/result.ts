export interface Ok<T> {
	/** @deprecated use {@link unwrap_unchecked} */
	ok: T,
	/** @deprecated use {@link is_ok} */
	isOk: true
}

export interface Err<T> {
	/** @deprecated use {@link unwrap_err_unchecked} */
	err: T,
	/**@deprecated use {@link is_err} */
	isOk: false,
}

export type Result<T, E> = Ok<T> | Err<E>

/*#__NO_SIDE_EFFECTS__*/
export function Ok<T>(v: T): Ok<T> {
	return { ok: v, isOk: true }
}

/*#__NO_SIDE_EFFECTS__*/
export function Err<T>(v: T): Err<T> {
	return { err: v, isOk: false }
}

/*#__NO_SIDE_EFFECTS__*/
export function is_ok<T>(v: Result<T, unknown>): v is Ok<T> {
	return !is_err(v)
}

/*#__NO_SIDE_EFFECTS__*/
export function is_err<E>(v: Result<unknown, E>): v is Err<E> {
	return !v.isOk
}

/*#__NO_SIDE_EFFECTS__*/
export function unwrap_err<T, E>(v: Result<T, E>) {
	if (!is_err(v)) throw new Error("Not in error.");
	return unwrap_err_unchecked(v);
}

/*#__NO_SIDE_EFFECTS__*/
export function unwrap_err_unchecked<E>(v: Err<E>) {
	return v.err
}

/*#__NO_SIDE_EFFECTS__*/
export function unwrap<T, E>(v: Result<T, E>): T {
	if (is_ok(v)) return unwrap_unsafe(v);
	throw unwrap_err_unchecked(v)
}

/*#__NO_SIDE_EFFECTS__*/
export function unwrap_unsafe<T>(v: Ok<T>): T {
	return v.ok;
}

/*#__NO_SIDE_EFFECTS__*/
export function unwrap_unchecked<T>(v: Ok<T>): T {
	return unwrap_unsafe(v)
}

/*#__NO_SIDE_EFFECTS__*/
export function unwrap_or<T, TT>(v: Result<T, unknown>, fallback: TT): T | TT {
	if (is_err(v)) return fallback;

	return unwrap_unchecked(v)
}

/*#__NO_SIDE_EFFECTS__*/
export function unwrap_or_else<T1, T2, E>(v: Result<T1, E>, fallback: (e: E) => T2): T1 | T2 {
	if (is_err(v)) return fallback(unwrap_err_unchecked(v) as E);

	return unwrap_unchecked(v)
}

/*#__NO_SIDE_EFFECTS__*/
export function and_then<T, E, O>(v: Result<T, E>, f: (v: T) => O): Result<O, E> {
	if (is_err(v)) return v;

	return Ok(f(unwrap(v)))
}

/*#__NO_SIDE_EFFECTS__*/
export function flatten<T, E1, E2>(v: Result<Result<T, E2>, E1>): Result<T, E1 | E2> {
	if (is_err(v)) return v;
	return unwrap(v);
}


/*#__NO_SIDE_EFFECTS__*/
export function zip<T, TT, E>(self: Result<T, E>, other: Result<TT, E>): Result<[T, TT], E> {
	if (is_err(self)) return self;
	if (is_err(other)) return other;

	return Ok([unwrap_unsafe(self), unwrap_unsafe(other)]);
}


/*#__NO_SIDE_EFFECTS__*/
export async function result_promise_transpose<T, E>(
	r: Result<Promise<T>, E>
): Promise<Result<T, E>> {
	if (is_err(r)) return r;
	return Ok(await unwrap_unsafe(r))
}

/**
 * Aggregates a set of {@link Result}s into a single Result.
 *
 * If an error occurs, only the *first* error will be in the new Result.
 */
/*#__NO_SIDE_EFFECTS__*/
export function result_collect<T, E>(arr: Result<T, E>[]): Result<T[], E> {
    const collected: T[] = [];

    for (const res of arr) {
        if (is_err(res)) {
            return res;
        }
        collected.push(unwrap_unsafe(res));
    }

    return Ok(collected);
}

/**
 * If this {@link Result} is {@link Some}thing, swap it out for input value
 * {@link v}
 */
/*#__NO_SIDE_EFFECTS__*/
export function result_and<V, E>(
	v: Result<unknown, E>,
	vv: V
): Result<V, E> {
	return is_ok(v)
		? Ok(vv)
		: v
}
