import * as Matrix from '#root/ts/math/matrix';
import { map, Vector } from '#root/ts/math/vec';
export type Point<T extends number = number> = Matrix.Matrix<1, T>;
export type Point2D = Point<2>;
export type Point3D = Point<3>;
export type Line2D<L extends number = number> = Vector<L, Point2D>;
export type Line3D<L extends number = number> = Vector<L, Point3D>;

export function point<T extends number>(...p: Vector<T, number>): Point<T> {
	return Matrix.fromVec(p);
}

export function x(p: Point<1>): number {
	return p[0]![0]!;
}

export function y(p: Point<2>): number {
	return p[1]![0]!;
}

export function z(p: Point<3>): number {
	return p[2]![0]!;
}

export { add, mul, sub } from '#root/ts/math/matrix';

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
