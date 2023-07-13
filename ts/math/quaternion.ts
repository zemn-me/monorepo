/**
 * @fileoverview This file implements Quaternion arithmetic. Quaternions are
 * a complex number construction analagous to vectors, and which are best used
 * for handling rotations in 3D space.
 */

/**
 * A Quaternion is a complex number representing both the position and the
 * rotation of an object in 3D space.
 */
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

	/**
	 * Return a new Quaternion representing a unit quaternion (i.e. a quaternion
	 * of length one). This preserves only its rotation in 3D space.
	 */
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
}
