import { point, Point3D, x, y, z } from "#root/ts/math/cartesian.js";
import { cross, dot, magnitude, normalise, sub } from "#root/ts/math/matrix.js";
import * as Quaternion from "#root/ts/math/quaternion.js";
import { and_then_flatten, Ok, type Result } from "#root/ts/result/result.js";

const EPSILON = 1e-6;

export const defaultUp = point<3>(0, 1, 0);

/**
 * Constructs a quaternion that rotates a default camera orientation:
 * - Default forward: (0,0,1)
 * - Default up: (0,1,0)
 *
 * So that it points from 'from' towards 'to', respecting the given 'up' vector.
 */
export function lookAt(from: Point3D, to: Point3D, up: Point3D = defaultUp): Result<Quaternion.Quaternion, Error> {
	const f0 = point<3>(0, 0, 1);
	const u0 = defaultUp;
	const f = normalise<3>(sub<1, 3>(to, from));
	const dotF = dot<3>(f0, f);
	let qF: Result<Quaternion.Quaternion, Error>;

	if (dotF > 1.0 - EPSILON) {
		qF = Ok(Quaternion.from(0, 0, 0, 1));
	} else if (dotF < -1.0 + EPSILON) {
		let axis = cross(u0, f0);
		if (magnitude(axis) < EPSILON) {
			axis = point<3>(1, 0, 0);
		} else {
			axis = normalise<3>(axis);
		}
		qF = Quaternion.fromAxisAngle(axis, Math.PI);
	} else {
		const axis = normalise<3>(cross(f0, f));
		qF = Quaternion.fromAxisAngle(axis, Math.acos(dotF));
	}

	const fLen = magnitude(f);
	const fUnit = (fLen > EPSILON)
		? point<3>(x(f) / fLen, y(f) / fLen, z(f) / fLen)
		: point<3>(0, 0, 1);

	return and_then_flatten(
		qF,
		forwardRotation => and_then_flatten(
			Quaternion.rotateVector(forwardRotation, u0),
			uPrime => {
				const dotU = dot<3>(uPrime, up);
				if (dotU > 1.0 - EPSILON) {
					return Ok(forwardRotation);
				}
				if (dotU < -1.0 + EPSILON) {
					return and_then_flatten(
						Quaternion.fromAxisAngle(fUnit, Math.PI),
						qRoll => Quaternion.normalize(Quaternion.multiply(qRoll, forwardRotation))
					);
				}

				return and_then_flatten(
					Quaternion.fromAxisAngle(fUnit, Math.acos(dotU)),
					qRoll => Quaternion.normalize(Quaternion.multiply(qRoll, forwardRotation))
				);
			}
		)
	);
}
