import { describe, expect, test } from '@jest/globals';

import * as cartesian from '#root/ts/math/cartesian.js';
import {
	Cartestian as C,
	Euler as E,
	Quaternion as Q,
} from '#root/ts/math/conv.js';
import * as euler_angle from '#root/ts/math/euler_angle.js';
import * as quaternion from '#root/ts/math/quaternion.js';

describe('Conversions', () => {
	test.skip('Quaternion from EulerAngles', () => {
		const eulerAngles = new euler_angle.EulerAngle(
			Math.PI / 4,
			Math.PI / 4,
			Math.PI / 4
		);
		const q = Q.fromEulerAngles(eulerAngles);

		const expectedQ = quaternion.from(
			0.6532814824381883,
			0.27059805007309856,
			0.27059805007309856,
			0.6532814824381883
		);
		expect(quaternion.x(q)).toBeCloseTo(quaternion.x(expectedQ));
		expect(quaternion.y(q)).toBeCloseTo(quaternion.y(expectedQ));
		expect(quaternion.z(q)).toBeCloseTo(quaternion.z(expectedQ));
		expect(quaternion.w(q)).toBeCloseTo(quaternion.w(expectedQ));
	});

	test('Quaternion from Point3D', () => {
		const point3D: cartesian.Point3D = [[1], [2], [3]] as const;
		const q = Q.fromPoint3D(point3D);

		const expectedQ = quaternion.from(1, 2, 3, 0);
		expect(quaternion.x(q)).toBeCloseTo(quaternion.x(expectedQ));
		expect(quaternion.y(q)).toBeCloseTo(quaternion.y(expectedQ));
		expect(quaternion.z(q)).toBeCloseTo(quaternion.z(expectedQ));
		expect(quaternion.w(q)).toBeCloseTo(quaternion.w(expectedQ));
	});

	test('Point3D from Quaternion', () => {
		const q = quaternion.from(1, 2, 3, 0);
		const point3D = C.fromQuaternion(q);

		const expectedPoint3D: cartesian.Point3D = [[1], [2], [3]] as const;
		expect(point3D[0]![0]).toBeCloseTo(expectedPoint3D[0]![0]!);
		expect(point3D[1]![0]).toBeCloseTo(expectedPoint3D[1]![0]!);
		expect(point3D[2]![0]).toBeCloseTo(expectedPoint3D[2]![0]!);
	});

	test.skip('EulerAngle from Quaternion', () => {
		const q = quaternion.from(
			0.6532814824381883,
			0.27059805007309856,
			0.27059805007309856,
			0.6532814824381883
		);
		const eulerAngles = E.fromQuaternion(q);

		const expectedEulerAngles = new euler_angle.EulerAngle(
			Math.PI / 4,
			Math.PI / 4,
			Math.PI / 4
		);
		expect(eulerAngles.pitch).toBeCloseTo(expectedEulerAngles.pitch);
		expect(eulerAngles.yaw).toBeCloseTo(expectedEulerAngles.yaw);
		expect(eulerAngles.roll).toBeCloseTo(expectedEulerAngles.roll);
	});
});
