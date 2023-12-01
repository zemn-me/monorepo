import * as cartesian from '#monorepo/ts/math/cartesian.js';
import {
	Cartestian as C,
	Euler as E,
	Quaternion as Q,
} from '#monorepo/ts/math/conv.js';
import * as euler_angle from '#monorepo/ts/math/euler_angle.js';
import * as quaternion from '#monorepo/ts/math/quaternion.js';

describe('Conversions', () => {
	test('Quaternion from EulerAngles', () => {
		const eulerAngles = new euler_angle.EulerAngle(
			Math.PI / 4,
			Math.PI / 4,
			Math.PI / 4
		);
		const q = Q.fromEulerAngles(eulerAngles);

		const expectedQ = new quaternion.Quaternion(
			0.6532814824381883,
			0.27059805007309856,
			0.27059805007309856,
			0.6532814824381883
		);
		expect(q.x).toBeCloseTo(expectedQ.x);
		expect(q.y).toBeCloseTo(expectedQ.y);
		expect(q.z).toBeCloseTo(expectedQ.z);
		expect(q.w).toBeCloseTo(expectedQ.w);
	});

	test('Quaternion from Point3D', () => {
		const point3D: cartesian.Point3D = [[1], [2], [3]] as const;
		const q = Q.fromPoint3D(point3D);

		const expectedQ = new quaternion.Quaternion(1, 2, 3, 0);
		expect(q.x).toBeCloseTo(expectedQ.x);
		expect(q.y).toBeCloseTo(expectedQ.y);
		expect(q.z).toBeCloseTo(expectedQ.z);
		expect(q.w).toBeCloseTo(expectedQ.w);
	});

	test('Point3D from Quaternion', () => {
		const q = new quaternion.Quaternion(1, 2, 3, 0);
		const point3D = C.fromQuaternion(q);

		const expectedPoint3D: cartesian.Point3D = [[1], [2], [3]] as const;
		expect(point3D[0][0]).toBeCloseTo(expectedPoint3D[0][0]);
		expect(point3D[1][0]).toBeCloseTo(expectedPoint3D[1][0]);
		expect(point3D[2][0]).toBeCloseTo(expectedPoint3D[2][0]);
	});

	test('EulerAngle from Quaternion', () => {
		const q = new quaternion.Quaternion(
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
