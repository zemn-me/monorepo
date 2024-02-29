/**
 * For an iterable, return its minimum and maximum values.
 */
export function extent<T>(
	v: Iterable<T>,
	pick: (v: T) => number
): [min: number, max: number] {
	let min: number = Infinity,
		max: number = -Infinity;
	for (const val of v) {
		const value = pick(val);
		if (value < min) {
			min = value;
		}

		if (value > max) {
			max = value;
		}
	}

	return [min, max];
}
