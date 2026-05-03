import { describe, expect, test } from '@jest/globals';

import { point } from '#root/ts/math/cartesian.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { is_err, is_ok, unwrap, unwrap_err } from '#root/ts/result/result.js';

describe('Quaternion arithmetic', () => {
	test('addition', () => {
		const q1 = Quaternion.from(1, 2, 3, 4);
		const q2 = Quaternion.from(4, 3, 2, 1);

		const result = Quaternion.add(q1, q2);
		expect(Quaternion.x(result)).toBeCloseTo(5);
		expect(Quaternion.y(result)).toBeCloseTo(5);
		expect(Quaternion.z(result)).toBeCloseTo(5);
		expect(Quaternion.w(result)).toBeCloseTo(5);
	});

	test('subtraction', () => {
		const q1 = Quaternion.from(1, 2, 3, 4);
		const q2 = Quaternion.from(4, 3, 2, 1);

		const result = Quaternion.subtract(q1, q2);
		expect(Quaternion.x(result)).toBeCloseTo(-3);
		expect(Quaternion.y(result)).toBeCloseTo(-1);
		expect(Quaternion.z(result)).toBeCloseTo(1);
		expect(Quaternion.w(result)).toBeCloseTo(3);
	});

	test('multiplication', () => {
		const q1 = Quaternion.from(1, 2, 3, 4);
		const q2 = Quaternion.from(4, 3, 2, 1);

		const result = Quaternion.multiply(q1, q2);
		expect(Quaternion.x(result)).toBeCloseTo(12);
		expect(Quaternion.y(result)).toBeCloseTo(24);
		expect(Quaternion.z(result)).toBeCloseTo(6);
		expect(Quaternion.w(result)).toBeCloseTo(-12);
	});

	test('normalize', () => {
		const q = Quaternion.from(1, 2, 3, 4);
		const normalizedQ = Quaternion.normalize(q);
		expect(is_ok(normalizedQ)).toBe(true);

		expect(Quaternion.length(unwrap(normalizedQ))).toBeCloseTo(1);

		const expectedNormalizedQ = Quaternion.from(0.18257, 0.36515, 0.54772, 0.7303);
		expect(Quaternion.x(unwrap(normalizedQ))).toBeCloseTo(Quaternion.x(expectedNormalizedQ), 4);
		expect(Quaternion.y(unwrap(normalizedQ))).toBeCloseTo(Quaternion.y(expectedNormalizedQ), 4);
		expect(Quaternion.z(unwrap(normalizedQ))).toBeCloseTo(Quaternion.z(expectedNormalizedQ), 4);
		expect(Quaternion.w(unwrap(normalizedQ))).toBeCloseTo(Quaternion.w(expectedNormalizedQ), 4);
	});

	test('fromAxisAngle ignores axis scale', () => {
		const ninetyDegrees = Math.PI / 2;
		const unitAxis = point<3>(0, 1, 0);
		const scaledAxis = point<3>(0, 5, 0);

		const fromUnit = Quaternion.fromAxisAngle(unitAxis, ninetyDegrees);
		const fromScaled = Quaternion.fromAxisAngle(scaledAxis, ninetyDegrees);
		expect(is_ok(fromUnit)).toBe(true);
		expect(is_ok(fromScaled)).toBe(true);

		expect(Quaternion.x(unwrap(fromScaled))).toBeCloseTo(Quaternion.x(unwrap(fromUnit)));
		expect(Quaternion.y(unwrap(fromScaled))).toBeCloseTo(Quaternion.y(unwrap(fromUnit)));
		expect(Quaternion.z(unwrap(fromScaled))).toBeCloseTo(Quaternion.z(unwrap(fromUnit)));
		expect(Quaternion.w(unwrap(fromScaled))).toBeCloseTo(Quaternion.w(unwrap(fromUnit)));
	});

	test('fromAxisAngle rejects a zero axis', () => {
		const axis = point<3>(0, 0, 0);
		const result = Quaternion.fromAxisAngle(axis, Math.PI / 4);
		expect(is_err(result)).toBe(true);
		expect(unwrap_err(result).message).toBe('Cannot construct a quaternion from a zero-length axis.');
	});
});
