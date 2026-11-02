import { map } from '#root/ts/iter';

/**
 * For an N-length array of 2-tuples representing the domain of data in axis N,
 * returns a domain such that all data from all axes could be contained in a single
 * unified domain for all axes.
 *
 * This seems very complicated in abstract but this function solves the simple problem of
 * how to render a dataset that is placed in space somewhere in a finitely shaped box.
 *
 * You could have any number of points in your dataset, and we have to decide where
 * those points should go in your finitely-sized computer screen, or rendering.
 *
 * For example:
 *
 * ```
 * 	H H
 * 	H H
 * 	HHH
 * 	H H
 * 	H H
 * ```
 *
 * This is the letter 'H' made of H-es. If we want to render it in a smaller space, like this
 * rectangle:
 * ```
 * 	|-----------|
 * 	|           |
 * 	|-----------|
 *
 * ```
 *
 * We have to decide whether to crop out some parts of it or whether to scale them down. Contain mode scales down,
 * but as a result might introduce extra space around the drawing area.
 *
 * We do this by picking the minimum and maximum value that is all axes.
 */
export function domainScaleFitContain<T>(
	domains: Iterable<T>,
	min: (v: T) => number,
	max: (v: T) => number
): [min: number, max: number] {
	const all = [...map(domains, v => [min(v), max(v)])].flat(1);
	const minV = Math.min(...all);
	const maxV = Math.max(...all);

	return [minV, maxV];
}

/**
 * Transforms a 2D space into a 1D array.
 */
export const unrolledSpace2D = (width: number) =>
	[unrolledSpaceIndex(width), unrolledSpaceLength(width)] as const;

export const unrolledSpaceIndex = (width: number) => (x: number, y: number) =>
	x + y * width;
export const unrolledSpaceLength = (width: number) => (height: number) =>
	width * height;
