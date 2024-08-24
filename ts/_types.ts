export const _ok = Symbol();
export const _err = Symbol();

export type Ok<T> = { [_ok]: T, [_err]?: undefined }
export type Err<T> = { [_err]: T, [_ok]?: undefined }
export type Result<T, E> = Ok<T> | Err<E>

export function Ok<T>(v: T): Ok<T> {
	return { [_ok]: v }
}

export function Err<T>(v: T): Err<T> {
	return { [_err]: v }
}

export function is_ok<T>(v: Result<T, unknown>): v is Ok<T> {
	return !is_err(v)
}

export function is_err<E>(v: Result<unknown, E>): v is Err<E> {
	return _err in v
}

export function unwrap<T, E>(v: Result<T, E>): T {
	if (is_ok(v)) return v[_ok];
	throw v[_err];
}

export function unwrap_or<T>(v: Result<T, unknown>, fallback: T): T {
	if (is_err(v)) return fallback;

	return v[_ok]
}

export function unwrap_or_else<T1, T2, E>(v: Result<T1, unknown>, fallback: (e: E) => T2): T1 | T2 {
	if (is_err(v)) return fallback(v[_err] as E);

	return v[_ok]
}

export function and_then<T, E, O>(v: Result<T, E>, f: (v: T) => O): Result<O, E> {
	if (is_err(v)) return v;

	return Ok(f(unwrap(v)))
}

export function flatten<T, E1, E2>(v: Result<Result<T, E2>, E1>): Result<T, E1 | E2> {
	if (is_err(v)) return v;
	return unwrap(v);
}

