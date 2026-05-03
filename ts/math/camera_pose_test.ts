import { describe, expect, test } from '@jest/globals';

import {
	cameraSpacePointFromPose,
	forwardFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { point } from '#root/ts/math/cartesian.js';
import { unwrap } from '#root/ts/result/result.js';

describe('camera_pose', () => {
	test('forwardFromPose follows yaw', () => {
		const forward = unwrap(forwardFromPose({
			yaw: Math.PI / 2,
			pitch: 0,
		}));

		expect(forward[0]![0]!).toBeCloseTo(1, 5);
		expect(forward[1]![0]!).toBeCloseTo(0, 5);
		expect(forward[2]![0]!).toBeCloseTo(0, 5);
	});

	test('cameraSpacePointFromPose keeps a forward point centered in camera space', () => {
		const pose: YawPitchPose = {
			position: point<3>(0, 0, 0),
			yaw: Math.PI / 2,
			pitch: 0,
		};

		const cameraPoint = unwrap(cameraSpacePointFromPose(point<3>(10, 0, 0), pose));

		expect(cameraPoint[0]![0]!).toBeCloseTo(0, 5);
		expect(cameraPoint[1]![0]!).toBeCloseTo(0, 5);
		expect(cameraPoint[2]![0]!).toBeGreaterThan(0);
	});
});
