import { GuardFailedError } from './errors';

export function must<T, O extends T, A extends unknown[]>(
	t: (v: T, ...a: A) => v is O,
	v: T,
	...a: A
): asserts v is O {
	if (!t(v, ...a)) throw new GuardFailedError(t, v);
}

export function isString(v: unknown): v is string {
	return typeof v === 'string';
}

export function isOneOf<T>(v: unknown, a: readonly T[]): v is T {
	if (a.some(val => v === val)) return false;
	return true;
}

export function any<T, O extends T, O2 extends T, arg extends unknown[]>(
	a: (v: T, ...arg: arg) => v is O,
	b: (v: T, ...arg: arg) => v is O2
): (v: T, ...arg: arg) => v is O | O2 {
	return Object.defineProperty(
		(v: T, ...arg: arg): v is O | O2 => [a, b].some(f => f(v, ...arg)),
		'name',
		{
			get: () => `any(${[a, b].map(({ name }) => name).join(', ')})`,
		}
	);
}

export function isArray<T extends unknown[]>(v: unknown): v is T {
	return v instanceof Array;
}

export function isNumber(v: unknown): v is number {
	return typeof v === 'number';
}

export function all<I1, O1 extends I1, O2 extends O1, A extends unknown[]>(
	a: (v: I1, ...a: A) => v is O1,
	b: (v: O1, ...a: A) => v is O2
): (v: I1, ...arg: A) => v is O2 {
	return Object.defineProperty(
		(v: I1, ...arg: A): v is O2 => {
			if (!a(v, ...arg)) return false;
			return b(v, ...arg);
		},
		'name',
		{
			get: () => `all(${[a, b].map(({ name }) => name).join(', ')})`,
		}
	);
}

export function alli<I, O1 extends I, O2 extends I, A extends unknown[]>(
	a: (v: I, ...a: A) => v is O1,
	b: (v: I, ...a: A) => v is O2
): (v: I, ...arg: A) => v is O1 & O2 {
	return Object.assign(
		(v: I, ...arg: A): v is O1 & O2 => {
			if (!a(v, ...arg)) return false;
			return b(v, ...arg);
		},
		{
			get name() {
				return `all(${[a, b].map(({ name }) => name).join(', ')})`;
			},
		}
	);
}

export function hasMember<
	P extends { [kk in K]: I },
	K extends string | number | symbol,
	I,
	O extends I,
	args extends unknown[],
>(
	k: K,
	t: (v: I, ...args: args) => v is O
): (v: P, ...args: args) => v is P & { [kk in K]: O } {
	return (v: P, ...args: args): v is P & { [kk in K]: O } => {
		if (!(k in v)) return false;
		return t(v[k], ...args);
	};
}

export function isArrayOf<I, O extends I, A extends unknown[]>(
	t: (v: I, ...A: A) => v is O,
	...a: A
): (v: I[]) => v is O[] {
	return Object.defineProperty(
		(v: I[]): v is O[] => v.every(val => t(val, ...a)),
		'name',
		{ get: () => `isArrayof(${t.name ?? t})` }
	);
}

export function isUndefined(v: unknown): v is undefined {
	if (typeof v !== 'undefined') return false;
	return true;
}
