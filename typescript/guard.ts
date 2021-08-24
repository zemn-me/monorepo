export function isNot<A, B>(f: (v: A | B) => v is B): (v: A | B) => v is A {
	return (v: A | B): v is A => !f(v);
}

/**
 * Returns true if the value is not undefined
 */
export function isDefined<T>(i: T | undefined): i is T {
	return i !== undefined;
}
