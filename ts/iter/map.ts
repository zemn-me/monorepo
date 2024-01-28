import { None, Option, Some } from '#root/ts/option.js';
import { ResultSequence as R } from '#root/ts/result.js';

export type Collection<M, K, I, O> = [
	get: (m: M, k: K) => Option<O>,
	set: (m: M, k: K, v: I) => M,
];

/**
 * amends / specialises a Collection based on a conversion function.
 */
export const specialiseCollection =
	<M, K, I, O>([g0, s0]: Collection<M, K, I, O>) =>
	<I2, O2>([g1, s1]: [
		get: (v: Option<O>) => Option<O2>,
		set: (v: I2) => I,
		// eslint-disable-next-line array-bracket-newline
	]): Collection<M, K, I2, O2> => [
		(m, k) => g1(g0(m, k)),
		(m, k, v) => s0(m, k, s1(v)),
	];

export const mapCollection = <K, V>(): Collection<Map<K, V>, K, V, V> => [
	(m, k) => (m.has(k) ? { [Some]: m.get(k)! } : { [None]: undefined }),
	(m, k, v) => {
		m.set(k, v);

		return m;
	},
];
