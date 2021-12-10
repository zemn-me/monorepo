/**
 * @fileoverview This file implements Quaternion arithmetic. Quaternions are
 * a complex number construction analagous to vectors, and which are best used
 * for handling rotations in 3D space.
 */

import { Point3D } from './cartesian';

export type Quaternion = [r: number, i: number, j: number, k: number];
export type ReadonlyQuaternion = readonly [
	r: number,
	i: number,
	j: number,
	k: number
];

export function fromPoint3D([[x, y, z]]: Point3D): Quaternion {
	return [x, y, z, 0];
}

export function add(
	[r1 = 0, i1 = 0, j1 = 0, k1 = 0]: ReadonlyQuaternion,
	[r2 = 0, i2 = 0, j2 = 0, k2 = 0]: ReadonlyQuaternion
): Quaternion {
	return [r1 + r2, i1 + i2, j1 + j2, k1 + k2];
}

export function adds(...q: ReadonlyQuaternion[]): Quaternion {
	const [first, ...etc] = q;
	let val: Quaternion = [...first];
	for (const v of etc) val = add(val, v);
	return val;
}

export function mul(
	[r1 = 0, i1 = 0, j1 = 0, k1 = 0]: ReadonlyQuaternion,
	[r2 = 0, i2 = 0, j2 = 0, k2 = 0]: ReadonlyQuaternion
): Quaternion {
	const a1 = r1,
		a2 = r2,
		b1 = i1,
		b2 = i2,
		c1 = j1,
		c2 = j2,
		d1 = k1,
		d2 = k2;

	return [
		/* r */ a1 * a2 - b1 * b2 - c1 * c2 - d1 * d2,
		/* i */ a1 * b2 + b1 * a2 + c1 * d2 - d1 * c2,
		/* j */ a1 * c2 - b1 * d2 + c1 * a2 + d1 * b2,
		/* k */ a1 * d2 + b1 * c2 - c1 * b2 + d2 * a2,
	];
}

/**
 * conjugate returns, for a given quaternion the same quaternion except with
 * its complex parts negated.
 * @see https://en.wikipedia.org/wiki/Complex_conjugate
 * @see https://en.wikipedia.org/wiki/Quaternion#Conjugation,_the_norm,_and_reciprocal
 */
export function conjugate([r, i, j, k]: ReadonlyQuaternion): Quaternion {
	return [r, -i, -j, -k];
}

/**
 * Rotates a 3d vector p via the rotation quaternion q.
 *
 * @see https://liorsinai.github.io/mathematics/2021/12/03/quaternion-3.html
 */
export function rotate(p: Point3D, q: Quaternion) {
	return mul(mul(q, fromPoint3D(p)), conjugate(q));
}
