import * as Matrix from '#root/ts/math/matrix.js';
import { map } from '#root/ts/math/vec.js';
export type Point<T extends number = number> = Matrix.Matrix<1, T>;
export type Point2D = Point<2>;
export type Point3D = Point<3>;
export type Line2D = Point2D[];
export type Line3D = Point3D[];

/**
 * For a hyperrectangle of N dimensions defined by a minimum
 * and maximum point, returns if a point would exist inside that
 * rectangle.
 */
export const rectContaninsPoint =
	<N extends number>(min: Point<N>) =>
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
	v: Array<number> & { length: L }
): Point<L> {
	return map(v, n => [n] as [number]);
}
