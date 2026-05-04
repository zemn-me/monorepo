import { describe, expect, test } from '@jest/globals';

import { point } from '#root/ts/math/cartesian.js';
import * as Quaternion from '#root/ts/math/quaternion.js';

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

		expect(Quaternion.length(normalizedQ)).toBeCloseTo(1);

		const expectedNormalizedQ = Quaternion.from(
			0.18257,
			0.36515,
			0.54772,
			0.7303
		);
		expect(Quaternion.x(normalizedQ)).toBeCloseTo(
			Quaternion.x(expectedNormalizedQ),
			4
		);
		expect(Quaternion.y(normalizedQ)).toBeCloseTo(
			Quaternion.y(expectedNormalizedQ),
			4
		);
		expect(Quaternion.z(normalizedQ)).toBeCloseTo(
			Quaternion.z(expectedNormalizedQ),
			4
		);
		expect(Quaternion.w(normalizedQ)).toBeCloseTo(
			Quaternion.w(expectedNormalizedQ),
			4
		);
	});

	test('fromAxisAngle ignores axis scale', () => {
		const ninetyDegrees = Math.PI / 2;
		const unitAxis = point<3>(0, 1, 0);
		const scaledAxis = point<3>(0, 5, 0);

		const fromUnit = Quaternion.fromAxisAngle(unitAxis, ninetyDegrees);
		const fromScaled = Quaternion.fromAxisAngle(scaledAxis, ninetyDegrees);

		expect(Quaternion.x(fromScaled)).toBeCloseTo(Quaternion.x(fromUnit));
		expect(Quaternion.y(fromScaled)).toBeCloseTo(Quaternion.y(fromUnit));
		expect(Quaternion.z(fromScaled)).toBeCloseTo(Quaternion.z(fromUnit));
		expect(Quaternion.w(fromScaled)).toBeCloseTo(Quaternion.w(fromUnit));
	});

	test('fromAxisAngle rejects a zero axis', () => {
		const axis = point<3>(0, 0, 0);

		expect(() => Quaternion.fromAxisAngle(axis, Math.PI / 4)).toThrow(
			'Cannot construct a quaternion from a zero-length axis.'
		);
	});
});
