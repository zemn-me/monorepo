/**
 * @fileoverview Purely functional dual quaternion arithmetic backed by Church-encoded quaternions.
 */

import { point, Point3D, x, y, z } from '#root/ts/math/cartesian.js';
import * as Quaternion from '#root/ts/math/quaternion.js';

export type DualQuaternion = <R>(
	selector: (real: Quaternion.Quaternion, dual: Quaternion.Quaternion) => R
) => R;

export const from =
	(
		real: Quaternion.Quaternion,
		dual: Quaternion.Quaternion
	): DualQuaternion =>
	selector =>
		selector(real, dual);

export const real = (dq: DualQuaternion): Quaternion.Quaternion =>
	dq(real => real);
export const dual = (dq: DualQuaternion): Quaternion.Quaternion =>
	dq((_, dual) => dual);

const map = (
	dq: DualQuaternion,
	f: (q: Quaternion.Quaternion) => Quaternion.Quaternion
): DualQuaternion => dq((r, d) => from(f(r), f(d)));

const zip = (
	a: DualQuaternion,
	b: DualQuaternion,
	f: (
		a: Quaternion.Quaternion,
		b: Quaternion.Quaternion
	) => Quaternion.Quaternion
): DualQuaternion => a((ar, ad) => b((br, bd) => from(f(ar, br), f(ad, bd))));

export const add = (lhs: DualQuaternion, rhs: DualQuaternion): DualQuaternion =>
	zip(lhs, rhs, Quaternion.add);

export const subtract = (
	lhs: DualQuaternion,
	rhs: DualQuaternion
): DualQuaternion => zip(lhs, rhs, Quaternion.subtract);

export const multiply = (
	lhs: DualQuaternion,
	rhs: DualQuaternion
): DualQuaternion =>
	lhs((lhsReal, lhsDual) =>
		rhs((rhsReal, rhsDual) =>
			from(
				Quaternion.multiply(lhsReal, rhsReal),
				Quaternion.add(
					Quaternion.multiply(lhsReal, rhsDual),
					Quaternion.multiply(lhsDual, rhsReal)
				)
			)
		)
	);

export const length = (dq: DualQuaternion): number =>
	Quaternion.length(real(dq));

export const normalize = (dq: DualQuaternion): DualQuaternion => {
	const realLen = Quaternion.length(real(dq));
	if (realLen === 0) {
		throw new Error(
			'Cannot normalize a dual quaternion with zero real length.'
		);
	}
	return map(dq, q =>
		Quaternion.from(
			Quaternion.x(q) / realLen,
			Quaternion.y(q) / realLen,
			Quaternion.z(q) / realLen,
			Quaternion.w(q) / realLen
		)
	);
};

export const transformPoint = (dq: DualQuaternion, p: Point3D): Point3D => {
	const rotation = Quaternion.normalize(real(dq));
	const translationQuat = Quaternion.multiply(
		dual(dq),
		Quaternion.inverse(rotation)
	);
	const translation = point<3>(
		2 * Quaternion.x(translationQuat),
		2 * Quaternion.y(translationQuat),
		2 * Quaternion.z(translationQuat)
	);
	const rotated = Quaternion.rotateVector(rotation, p);
	return point<3>(
		x(rotated) + x(translation),
		y(rotated) + y(translation),
		z(rotated) + z(translation)
	);
};

export const fromRotationTranslation = (
	rotation: Quaternion.Quaternion,
	translation: Point3D
): DualQuaternion => {
	const unitRotation = Quaternion.normalize(rotation);
	const translationQuaternion = Quaternion.from(
		x(translation),
		y(translation),
		z(translation),
		0
	);
	const dualPart = Quaternion.multiply(translationQuaternion, unitRotation);
	return from(
		unitRotation,
		Quaternion.from(
			Quaternion.x(dualPart) * 0.5,
			Quaternion.y(dualPart) * 0.5,
			Quaternion.z(dualPart) * 0.5,
			Quaternion.w(dualPart) * 0.5
		)
	);
};
