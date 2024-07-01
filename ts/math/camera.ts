import * as Homog from '#root/ts/math/homog';
import * as Matrix from '#root/ts/math/matrix';

export type FocalLength = number;

/**
 * Return a camera matrix given a particular focal length
 * representing a camera about (0, 0, 0)
 */
export const matrix = (f: FocalLength): Matrix.Matrix<4, 3, number> => [
	[1, 0, 0, 0],
	[0, 1, 0, 0],
	[0, 0, 1 / f, 0],
];

export const transform: (i: Homog.Point3D, f?: FocalLength) => Homog.Point2D = (
	i,
	f = 1
) => Matrix.mul<4, 3, 1, 4>(matrix(f), i);
