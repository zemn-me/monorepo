export function isNot<A, B>(f: (v: A | B) => v is B): (v: A | B) => v is A {
	return (v: A | B): v is A => !f(v);
}

/**
 * Returns true if the value is not undefined
 */
export function isDefined<T>(i: T | undefined): i is T {
	return i !== undefined;
}

export function must<I, O extends I>(f: (v: I) => v is O): (v: I) => O {
	return v => {
		if (!f(v)) throw new Error(`${v} not ${f.name}`);
		return v;
	};
}

export function assert<I, O extends I>(f: (i: I) => asserts i is O) {
	return (v: I): v is O => {
		f(v);

		return true;
	};
}

export function asAssertion<I, O extends I>(
	f: (i: I) => i is O,
	e: (i: I) => Error
) {
	return (v: I): asserts v is O => {
		if (!f(v)) throw e(v);
	};
}

export function either<I, O1 extends I, O2 extends I>(
	f1: (v: I) => v is O1,
	f2: (v: I) => v is O2
) {
	return (v: I): v is O1 | O2 => f1(v) || f2(v);
}

export function all<I1, I2, O1 extends I1, O2 extends I2>(
	f1: (v: I1) => v is O1,
	f2: (v: I2) => v is O2
) {
	return (v: I1 & I2): v is O1 & O2 => f1(v) && f2(v);
}
