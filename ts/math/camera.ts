import { flow } from 'ramda';

import * as cartesian from "#root/ts/math/cartesian.js";
import { cartToHomog, homogToCart } from '#root/ts/math/conv.js';
import * as Homog from '#root/ts/math/homog.js';
import * as homog from '#root/ts/math/homog.js';
import { defaultUp, lookAt } from "#root/ts/math/lookAt.js";
import * as Matrix from '#root/ts/math/matrix.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { pipe } from '#root/ts/pipe.js';
import { bind_result, map_result, type Result } from '#root/ts/result/result.js';

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



export const Edges = Symbol();

export const camera = (
	position: cartesian.Point3D,
	lookingAt: cartesian.Point3D,
	/**
	 * The point to be transformed.
	 */
	point: cartesian.Point3D,
	focalLength: number = 1,
	up: cartesian.Point3D = defaultUp,
): Result<cartesian.Point2D, Error> =>
	pipe(
		lookAt(
			position,
			lookingAt,
			up
		),
		bind_result(orientation => Quaternion.rotateVector(
			orientation,
			cartesian.sub<1, 3>(point, position)
		)),
		map_result(rotated => flow(
			rotated,
			[
				(pt: cartesian.Point3D) => cartToHomog<3>(pt),
				(pt: homog.Point3D) => transform(
					pt, focalLength
				),
				(p: homog.Point2D) => homogToCart<2>(p)
			]
		))
	)
