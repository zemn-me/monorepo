import { describe, expect, test } from '@jest/globals';

import { point } from '#root/ts/math/cartesian.js';
import { type YawPitchPose } from '#root/ts/math/camera_pose.js';
import {
	perspective,
	projectCameraPoint,
	projectWorldPoint,
	renderSegments,
	type StyledSegment3D,
} from '#root/ts/math/wireframe_render.js';

describe('wireframe_render', () => {
	test('projectCameraPoint keeps a forward point at screen centre', () => {
		const projected = projectCameraPoint(
			point<3>(0, 0, 10),
			perspective(800, 600)
		);

		expect(projected[0]![0]!).toBeCloseTo(400, 5);
		expect(projected[1]![0]!).toBeCloseTo(300, 5);
	});

	test('projectWorldPoint returns null behind the near plane', () => {
		const pose: YawPitchPose = {
			position: point<3>(0, 0, 0),
			yaw: 0,
			pitch: 0,
		};

		expect(
			projectWorldPoint(point<3>(0, 0, -1), pose, perspective(800, 600))
		).toBeNull();
	});

	test('renderSegments renders visible geometry in front of the camera', () => {
		const pose: YawPitchPose = {
			position: point<3>(0, 1.8, -18),
			yaw: 0,
			pitch: 0,
		};
		const scene: StyledSegment3D[] = [
			Object.assign(
				[point<3>(-1, 1.8, -10), point<3>(1, 1.8, -10)] as const,
				{ stroke: '#fff', width: 1, opacity: 1 }
			),
		];

		const rendered = renderSegments(scene, pose, perspective(800, 600));

		expect(rendered).toHaveLength(1);
		expect(rendered[0]!.x1).toBeLessThan(rendered[0]!.x2);
	});
});
