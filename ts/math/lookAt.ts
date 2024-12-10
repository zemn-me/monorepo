import { point, Point3D, x, y, z } from "#root/ts/math/cartesian.js";
import { cross, dot, magnitude, normalise, sub } from "#root/ts/math/matrix.js";
import { Quaternion } from "#root/ts/math/quaternion.js";
const EPSILON = 1e-6;

/**
 * Constructs a quaternion that rotates a default camera orientation:
 * - Default forward: (0,0,1)
 * - Default up: (0,1,0)
 *
 * So that it points from 'from' towards 'to', respecting the given 'up' vector.
 */
export function lookAt(from: Point3D, to: Point3D, up: Point3D): Quaternion {
	const f0 = point<3>( 0, 0, 1 );
	const u0 = point<3>( 0, 1, 0 ); // default up

	// Desired forward direction
	const f = normalise<3>(sub<1, 3>(to, from));

	// Step 1: Rotate forward
	const dotF = dot<3>(f0, f);
	let qF: Quaternion;

	if (dotF > 1.0 - EPSILON) {
		// f0 and f are almost the same
		qF = new Quaternion(0, 0, 0, 1);
	} else if (dotF < -1.0 + EPSILON) {
		// f0 and f are opposite, rotate 180° around an axis perpendicular to f0
		let axis = cross(u0, f0);
		if (magnitude(axis) < EPSILON) {
			// If u0 and f0 are also collinear, pick another axis
			axis = point<3>(1, 0, 0);
		} else {
			axis = normalise<3>(axis);
		}
		qF = Quaternion.fromAxisAngle(axis, Math.PI);
	} else {
		// General case
		let axis = cross(f0, f);
		axis = normalise<3>(axis);
		const angle = Math.acos(dotF);
		qF = Quaternion.fromAxisAngle(axis, angle);
	}

	// Step 2: After applying qF, rotate u0 -> u'
	const uPrime = qF.rotateVector(u0);

	// Step 3: Rotate around f to align uPrime with up
	const dotU = dot<3>(uPrime, up);
	if (dotU > 1.0 - EPSILON) {
		// Already aligned
		return qF;
	}
	if (dotU < -1.0 + EPSILON) {
		// Opposite direction, rotate 180° around f
		const fLen = magnitude(f);
		const fUnit = (fLen > EPSILON) ? point<3>(x(f)/fLen, y(f)/fLen, z(f)/fLen ) : point<3>(0, 0, 1);
		const qRoll = Quaternion.fromAxisAngle(fUnit, Math.PI);
		return qRoll.multiply(qF).normalize();
	}

	const angleUp = Math.acos(dotU);
	const fLen = magnitude(f);
	const fUnit = (fLen > EPSILON) ? point<3>(x( f )/fLen, y( f )/fLen, z(f ) /fLen ) : point<3>(0, 0, 1);

	const qRoll = Quaternion.fromAxisAngle(fUnit, angleUp);
	return qRoll.multiply(qF).normalize();
}
