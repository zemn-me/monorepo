import {
	add,
	Line2D,
	Line3D,
	point,
	Point2D,
	Point3D,
	sub,
} from '#root/ts/math/cartesian.js';
import { map, Vector } from '#root/ts/math/vec.js';

/**
 * Generates a square as a set of lines
 */
export const square = (center: Point2D, radius: number): Line2D<4> => [
	sub<1, 2>(center, point<2>(-radius, -radius)),
	sub<1, 2>(center, point<2>(-radius, +radius)),
	sub<1, 2>(center, point<2>(+radius, +radius)),
	sub<1, 2>(center, point<2>(+radius, -radius)),
];

/**
 * Generates a cube as a set of lines
 */
export const cube = (
	center: Point3D,
	radius: number
): Vector<number, Line3D> => {
	const [[cx], [cy], [cz]] = center;

	const sq3d: Line3D<4> = map<4, Point2D, Point3D>(
		square(point<2>(cx, cy), radius),
		(pt): Point3D => [...pt, [0]]
	);

	const front = map(sq3d, pt => add<1, 3>(pt, point<3>(0, 0, cz + radius)));
	const back = map(sq3d, pt => add<1, 3>(pt, point<3>(0, 0, -(cz + radius))));

	return [front, back];
};
