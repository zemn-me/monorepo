export function map<V, O>(
	o: { [key: string]: V },
	f: (v: V) => O
): { [key: string]: O } {
	return Object.assign(
		{},
		...Object.entries(o).map(([n, el]) => ({ [n]: f(el) }))
	);
}

/**
 * For a given mapping function over some Iterable and a function
 * which can create new keys for new entries, produces a mapping
 * function instead for a dictionary type
 */
export function apply<V, N, A extends unknown[]>(
	f: (v: Iterable<V>, ...a: A) => Iterable<N>,
	n: (key: string, value: N) => string
): (v: { [key: string]: V }, ...a: A) => { [key: string]: N } {
	return (v: { [key: string]: V }, ...a: A): { [key: string]: N } => {
		let currentKey = '';
		const shim = (function* () {
			for (const [key, value] of Object.entries(v)) {
				currentKey = key;
				yield value;
			}
		})();

		const record = new Map<string, N>();

		for (const newValue of f(shim, ...a)) {
			let key = currentKey;
			if (record.has(currentKey)) key = n(key, newValue);

			record.set(key, newValue);
		}

		return Object.assign({}, ...[...record].map(([k, v]) => ({ [k]: v })));
	};
}

export function fromEntries<V>(
	i: Iterable<[string, V]>,
	onDupe: (k: string, V: V) => string = k => {
		throw new Error(`duplicate key ${k}`);
	}
): { [key: string]: V } {
	const o: { [key: string]: V } = {};
	for (let [k, v] of i) {
		while (k in o) k = onDupe(k, v);
		o[k] = v;
	}

	return o;
}

export function toEntries<V>(o: { [key: string]: V }): [string, V][] {
	return Object.entries(o);
}
