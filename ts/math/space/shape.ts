import { Line2D, point, Point2D } from '#root/ts/math/cartesian';

/**
 * Generates a square as a set of lines
 */
export const square = (center: Point2D, radius: number) => [
	point(sub(center, point(-radius, -radius))),
];
