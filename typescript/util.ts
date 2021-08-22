export function select<T, S>(values: T[], f: (arg0: T) => S) {
	const cache = new Map<S, T>();
	for (const v of values) cache.set(f(v), v);

	return (v: S): T | undefined => cache.get(v);
}
