export const Ok = Symbol();
export const Err = Symbol();
export type Ok<T> = { [Ok]: T };
export type Err<T> = { [Err]: T };
export type Result<O, E> = Ok<O> | Err<E>;

/**
 * Emulation of rust's ? operator.
 */
export class _ResultSequence<O, E> {
	static enhance<A extends unknown[], O, E>(f: (...a: A) => Result<O, E>) {
		return (...a: A) => new _ResultSequence(f(...a));
	}
	constructor(public readonly result: Result<O, E>) {}
	/**
	 * Chain a series of potentially failing operations.
	 * @param Do an operation to perform if no error occurred
	 */
	then<O2, E2>(Do: (v: O) => Result<O2, E2>): _ResultSequence<O2, E | E2> {
		if (Ok in this.result) return new _ResultSequence(Do(this.result[Ok]));

		return new _ResultSequence(this.result);
	}

	or<V>(v: V): O | V {
		if (Ok in this.result) return this.result[Ok];
		return v;
	}
}

export const ResultSequence = <O, E>(result: Result<O, E>) =>
	new _ResultSequence(result);
