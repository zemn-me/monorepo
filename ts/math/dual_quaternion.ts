/**
 * @fileoverview Purely functional dual quaternion arithmetic backed by Church-encoded quaternions.
 */

import { point, Point3D, x, y, z } from "#root/ts/math/cartesian.js";
import * as Quaternion from "#root/ts/math/quaternion.js";
import { pipe } from "#root/ts/pipe.js";
import {
	and_then,
	Err,
	map_result,
	Ok,
	pipe_result,
	type Result,
	zipped,
} from "#root/ts/result/result.js";


export type DualQuaternion = <R>(selector: (real: Quaternion.Quaternion, dual: Quaternion.Quaternion) => R) => R;

export const from = (real: Quaternion.Quaternion, dual: Quaternion.Quaternion): DualQuaternion =>
	selector => selector(real, dual);

export const real = (dq: DualQuaternion): Quaternion.Quaternion => dq(real => real);
export const dual = (dq: DualQuaternion): Quaternion.Quaternion => dq((_, dual) => dual);

const map = (dq: DualQuaternion, f: (q: Quaternion.Quaternion) => Quaternion.Quaternion): DualQuaternion =>
	dq((r, d) => from(f(r), f(d)));

const zip = (
	a: DualQuaternion,
	b: DualQuaternion,
	f: (a: Quaternion.Quaternion, b: Quaternion.Quaternion) => Quaternion.Quaternion
): DualQuaternion =>
	a((ar, ad) => b((br, bd) => from(f(ar, br), f(ad, bd))));

export const add = (lhs: DualQuaternion, rhs: DualQuaternion): DualQuaternion =>
	zip(lhs, rhs, Quaternion.add);

export const subtract = (lhs: DualQuaternion, rhs: DualQuaternion): DualQuaternion =>
	zip(lhs, rhs, Quaternion.subtract);

export const multiply = (lhs: DualQuaternion, rhs: DualQuaternion): DualQuaternion =>
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

export const length = (dq: DualQuaternion): number => Quaternion.length(real(dq));

export const normalize = (dq: DualQuaternion): Result<DualQuaternion, Error> => {
	const realLen = Quaternion.length(real(dq));
	if (realLen === 0) {
		return Err(new Error("Cannot normalize a dual quaternion with zero real length."));
	}
	return Ok(map(dq, q => Quaternion.from(
		Quaternion.x(q) / realLen,
		Quaternion.y(q) / realLen,
		Quaternion.z(q) / realLen,
		Quaternion.w(q) / realLen,
	)));
};

export const transformPoint2 = (dq: DualQuaternion, p: Point3D): Result<Point3D, Error> => {
	const rotation = Quaternion.normalize(real(dq));
	const rotated = pipe_result(
		rotation,
		r => Quaternion.rotateVector(r, p)
	);
	const inverseRotation = pipe_result(
		rotation,
		Quaternion.inverse
	);

	const translationQuat = and_then(
		inverseRotation,
		invRot => Quaternion.multiply(dual(dq), invRot)
	);

	return zipped(
		rotated, translationQuat,
		(rotated, translationQuat) => {
			const translation = point<3>(
				2 * Quaternion.x(translationQuat),
				2 * Quaternion.y(translationQuat),
				2 * Quaternion.z(translationQuat)
			);
			return point<3>(
				x(rotated) + x(translation),
				y(rotated) + y(translation),
				z(rotated) + z(translation)
			);
		}
	);
};

export const transformPoint = (dq: DualQuaternion, p: Point3D): Result<Point3D, Error> =>
	transformPoint2(dq, p);

export const fromRotationTranslation = (
	rotation: Quaternion.Quaternion,
	translation: Point3D
): Result<DualQuaternion, Error> =>
	pipe(
		Quaternion.normalize(rotation),
		map_result(unitRotation => {
			const translationQuaternion = Quaternion.from(x(translation), y(translation), z(translation), 0);
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
		})
	);
