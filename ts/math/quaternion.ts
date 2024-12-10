/**
 * @fileoverview This file implements Quaternion arithmetic. Quaternions are
 * a complex number construction analagous to vectors, and which are best used
 * for handling rotations in 3D space.
 */

import { point, Point3D, x, y, z } from "#root/ts/math/cartesian.js";

export class Quaternion<
	X extends number = number,
	Y extends number = number,
	Z extends number = number,
	W extends number = number,
> {
	constructor(
		public x: X,
		public y: Y,
		public z: Z,
		public w: W
	) {}

	/**
	 * Returns true if this Quaternion can be converted directly to a point
	 * in cartesian 3D space (i.e. its real component is zero).
	 */
	is_vector<X extends number, Y extends number, Z extends number>(
		this: Quaternion<X, Y, Z, number>
	): this is Quaternion<X, Y, Z, 0> {
		return this.w == 0
	}

	/**
	 * Converts a Quaternion whose real component is zero into a point in 3D
	 * space. ({@link is_vector} can be used to test that predicate).
	 */
	to_vector<X extends number, Y extends number, Z extends number>(this: Quaternion<X, Y, Z, 0>): Point3D {
		return point<3>(this.x, this.y, this.z)
	}

	multiply(this: Quaternion, b: Quaternion): Quaternion {
		const x = this.w * b.x + this.x * b.w + this.y * b.z - this.z * b.y;
		const y = this.w * b.y - this.x * b.z + this.y * b.w + this.z * b.x;
		const z = this.w * b.z + this.x * b.y - this.y * b.x + this.z * b.w;
		const w = this.w * b.w - this.x * b.x - this.y * b.y - this.z * b.z;
		return new Quaternion(x, y, z, w);
	}

	add(q: Quaternion): Quaternion {
		return new Quaternion(
			this.x + q.x,
			this.y + q.y,
			this.z + q.z,
			this.w + q.w
		);
	}

	subtract(q: Quaternion): Quaternion {
		return new Quaternion(
			this.x - q.x,
			this.y - q.y,
			this.z - q.z,
			this.w - q.w
		);
	}

	length(): number {
		return Math.sqrt(
			this.x * this.x +
				this.y * this.y +
				this.z * this.z +
				this.w * this.w
		);
	}

	normalize(): Quaternion {
		const length = this.length();
		if (length === 0) {
			throw new Error('Cannot normalize a quaternion with zero length.');
		}
		return new Quaternion(
			this.x / length,
			this.y / length,
			this.z / length,
			this.w / length
		);
	}

	inverse(): Quaternion {
		// Assuming normalized quaternion.
		const lenSq = this.x*this.x + this.y*this.y + this.z*this.z + this.w*this.w;
		if (lenSq === 0) {
			throw new Error('Cannot invert a zero-length quaternion.');
		}
		return new Quaternion(-this.x/lenSq, -this.y/lenSq, -this.z/lenSq, this.w/lenSq);
	}

	/**
	 * Rotates a vector by this quaternion.
	 */
	rotateVector(v: Point3D): Point3D {
		const qv = new Quaternion(x (v), y(v), z(v), 0);
		const inv = this.inverse();
		const res = this.multiply(qv).multiply(inv);
		return point<3>(res.x, res.y, res.z)
	}

	static fromAxisAngle(axis: Point3D, angle: number): Quaternion {
		const halfAngle = angle * 0.5;
		const s = Math.sin(halfAngle);
		return new Quaternion(
			x(axis)* s,
			y(axis)* s,
			z(axis)* s,
			Math.cos(halfAngle)
		).normalize();
	}
}
