/**
 * @fileoverview Memosort! a sort optimized for adding things to a big
 * list, which a human then edits.
 */

import { permute } from 'ts/iter';
import Immutable from 'immutable';

class NewType<T> {
	constructor(public readonly value: T) {}
}

/**
 * An array of things from biggest to smallest.
 */
export class Sorted<T> extends NewType<readonly T[]> {
	override toString(){ return this.value.toString() }
}

/**
 * A single assertion about the relation of
 * two things.
 */
type Datum<T> = readonly [T, T];

class CannotPrepend<T, E extends Error> extends Error {
	constructor(
		public readonly a: Sorted<T>,
		public readonly b: Sorted<T>,
		public readonly why: Error
	) {
		super(`Cannot prepend ${a} to ${b}: ${why}`);
	}
}

const last = <T>(a: Sorted<T>): T => a.value[a.value.length - 1];
const first = <T>(a: Sorted<T>): T => a.value[0];
const prepend = <T>(a: Sorted<T>, b: Sorted<T>) =>
	new Sorted([...a.value, ...b.value]);

/**
 * For two sorted sequences 'a' and 'b',
 * If sequence 'a' ends with the same value as sequence 'b' starts, 'a' is prepended to b.
 */
const tryPrependSame = <T>(
	a: Sorted<T>,
	b: Sorted<T>,
	equal: (a: T, b: T) => boolean
) => {
	if (equal(last(a), first(b))) return prepend(a, new Sorted(b.value.slice(1)));

	return new CannotPrepend(
		a,
		b,
		new Error(`${last(a)} and ${first(b)} are not the same.`)
	);
};

const tryContains = <T>(
	a: Sorted<T>,
	b: Sorted<T>,
	equal: (a: T, b: T) => boolean
) => {

	const idx = a.value.findIndex((v, i, a) =>
		equal(v, first(b)) && equal(a[i+1], last(b)));

	if (idx != -1) return new Sorted([
		...a.value.slice(0,idx),
		...b.value,
		...a.value.slice(idx+1)
	]);

	return new Error(`${a} does not contain ${first(b)},${last(b)}`);
};



export class Errors<E extends Error> extends Error {
	constructor(readonly errors: readonly E[]) {
		super(` ${errors.map(e => e.message).join(', ')}`);
		if (errors.length == 0) throw new Error("Must have at least one error!");
	}
}

const resultOrErrors =
	<V, E extends Error, A extends unknown[]>(...fs: ((...a: A) => V | E)[]) =>
	(...a: A): V | Errors<E> => {
		const errors: E[] = [];
		for (const f of fs) {
			const res = f(...a);
			if (!(res instanceof Error)) return res;

			errors.push(res);
		}

		return new Errors(errors);
	};

/**
 * Continue applying a function over a value until a condition is met.
 */
const until = <T, R>(
	v: T,
	f: (v: T) => R | T,
	cond: (v: R | T) => v is R
): R => {
	let r: R | T = v;
	while (!cond(r)) r = f(r);

	return r;
};

export const sort = <T>(
	data: Immutable.Set<Sorted<T>>,
	same: (a: T, b: T) => boolean
): Sorted<T> | Error => {
	const result = until<
		Immutable.Set<Sorted<T>>,
		(Immutable.Set<Sorted<T>> & { size: 1 }) | Error
	>(
		data,
		data => {
			const errors: Error[] = [];
			for (const [a, b] of permute(data)) {
				const res = resultOrErrors(
					(a: Sorted<T>, b: Sorted<T>) => tryPrependSame(a, b, same),
					(a: Sorted<T>, b: Sorted<T>) => tryContains(a, b, same)
					// TODO: splice condition
				)(a, b);

				if (!(res instanceof Error))
					return data.remove(a).remove(b).add(res);

				errors.push(res);
			}

			return new Errors(errors);
		},
		(
			result: Immutable.Set<Sorted<T>> | Error
		): result is (Immutable.Set<Sorted<T>> & { size: 1 }) | Error =>
			result instanceof Error || result.size === 1
	);

	if (result instanceof Error) return result;

	return [...result][0];
};
