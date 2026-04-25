/**
 * @fileoverview Purely functional quaternion arithmetic implemented with Church notation.
 */

import { magnitude, point, Point3D, x as pointX, y as pointY, z as pointZ } from "#root/ts/math/cartesian.js";

export type Quaternion<T = number> = <R>(selector: (x: T, y: T, z: T, w: T) => R) => R;

export const from = (x: number, y: number, z: number, w: number): Quaternion =>
	selector => selector(x, y, z, w);

export const x = (q: Quaternion): number => q(x => x);
export const y = (q: Quaternion): number => q((_, y) => y);
export const z = (q: Quaternion): number => q((_, __, z) => z);
export const w = (q: Quaternion): number => q((_, __, ___, w) => w);

const mapQuaternion = (q: Quaternion, f: (n: number) => number): Quaternion =>
	q((x, y, z, w) => from(f(x), f(y), f(z), f(w)));

const zipQuaternion = (
	a: Quaternion,
	b: Quaternion,
	f: (a: number, b: number) => number
): Quaternion =>
	a((ax, ay, az, aw) => b((bx, by, bz, bw) => from(
		f(ax, bx),
		f(ay, by),
		f(az, bz),
		f(aw, bw)
	)));

export const isVector = (q: Quaternion<number>): boolean => w(q) === 0;

export const toVector = (q: Quaternion<number>): Point3D => {
	if (!isVector(q)) {
		throw new Error("Cannot convert a non-vector quaternion to Point3D.");
	}
	return point<3>(x(q), y(q), z(q));
};

export const add = (a: Quaternion, b: Quaternion): Quaternion =>
	zipQuaternion(a, b, (lhs, rhs) => lhs + rhs);

export const subtract = (a: Quaternion, b: Quaternion): Quaternion =>
	zipQuaternion(a, b, (lhs, rhs) => lhs - rhs);

export const multiply = (a: Quaternion, b: Quaternion): Quaternion =>
	a((ax, ay, az, aw) => b((bx, by, bz, bw) => {
		const rx = aw * bx + ax * bw + ay * bz - az * by;
		const ry = aw * by - ax * bz + ay * bw + az * bx;
		const rz = aw * bz + ax * by - ay * bx + az * bw;
		const rw = aw * bw - ax * bx - ay * by - az * bz;
		return from(rx, ry, rz, rw);
	}));

export const length = (q: Quaternion): number =>
	Math.sqrt(q((x, y, z, w) => x * x + y * y + z * z + w * w));

export const normalize = (q: Quaternion): Quaternion => {
	const l = length(q);
	if (l === 0) {
		throw new Error("Cannot normalize a quaternion with zero length.");
	}
	return mapQuaternion(q, scalar => scalar / l);
};

export const inverse = (q: Quaternion): Quaternion => {
	const lenSq = q((x, y, z, w) => x * x + y * y + z * z + w * w);
	if (lenSq === 0) {
		throw new Error("Cannot invert a zero-length quaternion.");
	}
	return from(-x(q) / lenSq, -y(q) / lenSq, -z(q) / lenSq, w(q) / lenSq);
};

export const rotateVector = (q: Quaternion, v: Point3D): Point3D => {
	const qv = from(pointX(v), pointY(v), pointZ(v), 0);
	const rotated = multiply(multiply(q, qv), inverse(q));
	return point<3>(x(rotated), y(rotated), z(rotated));
};

export const fromAxisAngle = (axis: Point3D, angle: number): Quaternion => {
	const halfAngle = angle * 0.5;
	const s = Math.sin(halfAngle);
	const axisLength = magnitude(axis);
	if (axisLength === 0) {
		throw new Error("Cannot construct a quaternion from a zero-length axis.");
	}
	return from(
		pointX(axis) / axisLength * s,
		pointY(axis) / axisLength * s,
		pointZ(axis) / axisLength * s,
		Math.cos(halfAngle)
	);
};
