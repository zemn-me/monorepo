/**
 * For a given tree of values, return an iterable over those values, along with
 * the path it takes to get them
 */
export function* walk<T>(
	root: T,
	children: (v: T) => T[],
	path: T[] = []
): Generator<T[]> {
	yield [root, ...path];
	for (const child of children(root)) {
		yield* walk(child, children, [root, ...path]);
	}
}
