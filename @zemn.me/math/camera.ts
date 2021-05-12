import * as Matrix from './matrix'
import * as Homog from './homog'

export type FocalLength = number

/**
 * Return a camera matrix given a particular focal length
 * representing a camera about (0, 0, 0)
 */
export const matrix = (f: FocalLength) =>
	Matrix.as<4, 3>([
		[1, 0, 0, 0],
		[0, 1, 0, 0],
		[0, 0, 1 / f, 0],
	] as const)

export const transform: (i: Homog.Point3D, f?: FocalLength) => Homog.Point2D = (
	i,
	f = 1,
) => Matrix.mul(matrix(f), i)
