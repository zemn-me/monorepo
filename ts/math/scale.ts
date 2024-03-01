/**
 * Given an iterable of values that exist in a continuous space
 * and a constant discrete space size, iterate over the discrete
 * range each value exists in.
 *
 * For example, if my cell-size was 1, both 0.5 and 1 exist in the
 * same cell, so discrete([0.5, 1], x => x, 1) will return [[0.5, [0, 1]], [1, [0, 1]].
 */
export function* discrete<T>(
	v: Iterable<T>,
	pick: (v: T) => number,
	cellSize: number
) {
	for (const val of v) {
		const start = Math.floor(pick(val) / cellSize);
		const end = start + cellSize;
		yield [start, end];
	}
}
