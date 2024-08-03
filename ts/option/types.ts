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

