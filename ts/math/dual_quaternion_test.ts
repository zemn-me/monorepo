import { describe, expect, test } from '@jest/globals';

import { point } from '#root/ts/math/cartesian.js';
import * as DualQuaternion from '#root/ts/math/dual_quaternion.js';
import * as Quaternion from '#root/ts/math/quaternion.js';

describe('DualQuaternion arithmetic', () => {
	test('addition', () => {
		const left = DualQuaternion.from(
			Quaternion.from(1, 2, 3, 4),
			Quaternion.from(5, 6, 7, 8)
		);
		const right = DualQuaternion.from(
			Quaternion.from(2, 3, 4, 5),
			Quaternion.from(6, 7, 8, 9)
		);
		const result = DualQuaternion.add(left, right);

		expect(Quaternion.x(DualQuaternion.real(result))).toBe(3);
		expect(Quaternion.y(DualQuaternion.real(result))).toBe(5);
		expect(Quaternion.z(DualQuaternion.real(result))).toBe(7);
		expect(Quaternion.w(DualQuaternion.real(result))).toBe(9);
		expect(Quaternion.x(DualQuaternion.dual(result))).toBe(11);
		expect(Quaternion.y(DualQuaternion.dual(result))).toBe(13);
		expect(Quaternion.z(DualQuaternion.dual(result))).toBe(15);
		expect(Quaternion.w(DualQuaternion.dual(result))).toBe(17);
	});

	test('fromRotationTranslation and transformPoint', () => {
		const rotation = Quaternion.fromAxisAngle(
			point<3>(0, 0, 1),
			Math.PI / 2
		);
		const translation = point<3>(1, 2, 3);
		const dq = DualQuaternion.fromRotationTranslation(
			rotation,
			translation
		);
		const transformed = DualQuaternion.transformPoint(
			dq,
			point<3>(1, 0, 0)
		);

		expect(transformed[0]![0]!).toBeCloseTo(1);
		expect(transformed[1]![0]!).toBeCloseTo(3);
		expect(transformed[2]![0]!).toBeCloseTo(3);
	});

	test('normalize rejects zero real part', () => {
		const dq = DualQuaternion.from(
			Quaternion.from(0, 0, 0, 0),
			Quaternion.from(1, 0, 0, 0)
		);
		expect(() => DualQuaternion.normalize(dq)).toThrow(
			'Cannot normalize a dual quaternion with zero real length.'
		);
	});
});
