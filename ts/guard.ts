export function isNot<A, B>(f: (v: A | B) => v is B): (v: A | B) => v is A {
	return (v: A | B): v is A => !f(v);
}

export function isDefined<T>(i: T | undefined): i is T {
	return i !== undefined;
}

export function isNotNull<T>(i: T | null): i is T {
	return i !== null;
}

export function must<I, O extends I>(
	f: (v: I) => v is O,
	message?: () => string
): (v: I) => O {
	return v => {
		if (!f(v))
			throw new Error(
				`${v} not ${f.name} ${message ? `(${message()})` : ''}`
			);
		return v;
	};
}

export function and<I, A extends I, B extends I>(
	f1: (v: I) => v is A,
	f2: (v: I) => v is B
) {
	return (v: I): v is A & B => f1(v) && f2(v)
}

export function impossible(v: never, then: (v: never) => Error): asserts v is never {
	throw then(v);
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
