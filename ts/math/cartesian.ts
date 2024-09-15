import * as Matrix from '#root/ts/math/matrix.js';
import { magnitude as vecMag, map, unit as vecUnit, Vector } from '#root/ts/math/vec.js';
export type Point<T extends number = number> = Matrix.Matrix<1, T>;
export type Point2D = Point<2>;
export type Point3D = Point<3>;
export type Line2D<L extends number = number> = Vector<L, Point2D>;
export type Line3D<L extends number = number> = Vector<L, Point3D>;

export function denormalisePoint2D(p: Point2D): [x1: number, y1: number] {
	return [ x(p), y(p) ]
}

/**
 * Convert a polyline into a series of line segments.
 */
export function toLineSegments(
  line: Line2D
): Line2D<2>[] {
  const segments: Line2D<2>[] = [];

  for (let i = 0; i < line.length - 1; i++) {
    const segment: Line2D<2> = [line[i]!, line[i + 1]!];
    segments.push(segment);
  }

  return segments;
}

/**
 * Returns a representation of this Line2D not normalised
 * for use with matrix operations.
 */
export function denormaliseLine2D(l: Line2D<2>): [
	[x1: number, y1: number],
	[x2: number, y2: number]
] {
	return [
		[x1(l), y1(l)],
		[x2(l), y2(l)]
	]
}



export function point<T extends number>(...p: Vector<T, number>): Point<T> {
	return Matrix.fromVec(p);
}

/**
 * Return the normal line of a line.
 */
export function normal(l: Line2D<2>): Line2D<2> {
	const dx = x2(l) - x1(l);
	const dy = y2(l) - y1(l);

	return [
		[[-dy], [dx]],
		[[dy], [-dx]]
	]
}

/**
 * Returns the scalar length of a line.
 */
export function length(l: Line2D<2>): number {
	return magnitude(Matrix.sub<1, 2>(l[1], l[0]));
}

export function magnitude(l: Point): number {
	return vecMag(l.map(([v]) => v))
}

export function centre(l: Line2D<2>): Point2D {
	const xM = (x1(l) + x2(l)) / 2;
	const yM = (y1(l) + y2(l)) / 2;

	return [
		[xM],
		[yM]
	]
}


export function unit<N extends number>(l: Point<N>): Point<N> {
	return map(vecUnit(map(l, ([x]) => x)), x => [x]);
}

export function x1(l: Line2D<2>): number {
	return x(l[0])
}

export function x2(l: Line2D<2>): number {
	return x(l[1])
}

export function y1(l: Line2D<2>): number {
	return y(l[0])
}


export function y2(l: Line2D<2>): number {
	return y(l[1])
}

export function x(p: [...Point<1>, ...unknown[]]): number {
	return p[0]![0]!;
}

export function y(p: Point<2>): number {
	return p[1]![0]!;
}

export function z(p: Point<3>): number {
	return p[2]![0]!;
}

export { add, mul, sub } from '#root/ts/math/matrix.js';

/**
 * For a hyperrectangle of N dimensions defined by a minimum
 * and maximum point, returns if a point would exist inside that
 * rectangle.
 */
export const rectContaninsPoint =
	<const N extends number>(min: Point<N>) =>
	(max: Point<N>) =>
	(point: Point<N>): boolean =>
		point.every((col, ci) =>
			col.every(
				(scalar, ri) => scalar > min[ci]![ri]! && scalar < max[ci]![ri]!
			)
		);

/**
 * Given a point in form [x,y], return
 * in the matrix from [[x], [y]].
 */
export function cartesianCanonicalise<L extends number>(
	v: Vector<L>
): Point<L> {
	return map(v, n => [n]);
}
