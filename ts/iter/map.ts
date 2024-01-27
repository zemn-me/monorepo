import { None, Option, Some } from '#root/ts/option.js';
import { ResultSequence as R } from '#root/ts/result.js';

/**
 * Given a type which contains some nested type,
 * accumulate a value in the nested type.
 */
export const setDeeply =
	/**
	 * A map-like type.
	 */


		<M>(m: M) =>
		/**
		 * @param set function that sets a value in the map-like
		 */
		<K, V>(set: (m: M, k: K, v: V) => M) =>
		/**
		 *
		 * @param get function that gets a value from the map-like
		 */
		(get: (m: M, k: K) => Option<V>) =>
		/**
		 * @param acc function that adds two of the nested type
		 */
		(acc: (a: V, b: V) => V) =>
		/**
		 * @param New makes a new one of the nested type.
		 */
		(New: () => V) =>
		(k: K) =>
		(v: V) =>
			set(m, k, acc(R(get(m, k)).or(New()), v));

export const groupBy =
	/**
	 * @param m A map-like type.
	 */


		<M>(m: M) =>
		/**
		 * @param set function that sets a value in the map-like
		 */
		<K, V>(set: (m: M, k: K, v: V) => M) =>
		/**
		 *
		 * @param get function that gets a value from the map-like
		 */
		(get: (m: M, k: K) => Option<V>) =>
		/**
		 * @param acc function that adds two of the nested type
		 */
		(acc: (a: V, b: V) => V) =>
		/**
		 * @param New makes a new one of the nested type.
		 */
		(New: () => V) =>
		/**
		 * @param i an iterable of values to add
		 */
		<Q>(i: Iterable<Q>) =>
		/**
		 * @param select gets a key for an item
		 */
		(select: (v: Q) => K) => {
			for (const val of i) {
				m = setDeeply(m)(set)(get)(acc)(New)(select(val))(val);
			}
			return m;
		};

/**
 * Given an iterable of items, and a 'select' which gets keys for those items,
 * returns a Map from that key to all the items that have the same key.
 */
export const groupMapList =
	/**
	 * @param i an iterable of values to add
	 */


		<V>(i: Iterable<V>) =>
		/**
		 * @param select gets a key for an item
		 */
		<K>(select: (v: V) => K) =>
			groupBy(new Map<K, V[]>())((m: Map<K, V[]>, k: K, v: V[]) => {
				m.set(k, v);
				return m;
			})((m, k) =>
				m.has(k) ? { [None]: undefined } : { [Some]: m.get(k)! }
			)((a, b) => a.concat(b))(() => [])(i)(select);
