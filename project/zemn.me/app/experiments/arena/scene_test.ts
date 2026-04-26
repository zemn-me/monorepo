import { describe, expect, test } from '@jest/globals';

import {
	DEFAULT_POSE,
	forwardFromPose,
	type MovementInput,
	projectPoint,
	projectWorldPoint,
	renderScene,
	stepPlayer,
	type WorldSegment,
} from '#root/project/zemn.me/app/experiments/arena/scene.js';
import { point } from '#root/ts/math/cartesian.js';

describe('arena scene', () => {
	test('moving forward follows yaw', () => {
		const input: MovementInput = {
			forward: 1,
			strafe: 0,
			sprint: false,
		};
		const moved = stepPlayer(
			{
				...DEFAULT_POSE,
				position: point<3>(0, DEFAULT_POSE.position[1]![0]!, 0),
				yaw: Math.PI / 2,
			},
			input,
			1
		);

		expect(moved.position[0]![0]!).toBeCloseTo(5, 5);
		expect(moved.position[2]![0]!).toBeCloseTo(0, 5);
	});

	test('point straight ahead projects to screen centre', () => {
		const projected = projectPoint(point<3>(0, 0, 10), 800, 600);

		expect(projected[0]![0]!).toBeCloseTo(400, 5);
		expect(projected[1]![0]!).toBeCloseTo(300, 5);
	});

	test('distant points shrink toward the centre', () => {
		const near = projectPoint(point<3>(1, 0, 2), 800, 600);
		const far = projectPoint(point<3>(1, 0, 20), 800, 600);

		expect(Math.abs(near[0]![0]! - 400)).toBeGreaterThan(
			Math.abs(far[0]![0]! - 400)
		);
	});

	test('visible geometry in front of the camera is rendered', () => {
		const scene: WorldSegment[] = [
			{
				start: point<3>(-1, DEFAULT_POSE.position[1]![0]!, -10),
				end: point<3>(1, DEFAULT_POSE.position[1]![0]!, -10),
				stroke: '#fff',
				width: 1,
				opacity: 1,
			},
		];
		const rendered = renderScene(scene, DEFAULT_POSE, 800, 600);

		expect(rendered).toHaveLength(1);
		expect(rendered[0]!.x1).toBeLessThan(rendered[0]!.x2);
	});

	test('turning right keeps the viewed forward point centred', () => {
		const pose = {
			...DEFAULT_POSE,
			position: point<3>(0, DEFAULT_POSE.position[1]![0]!, 0),
			yaw: Math.PI / 2,
			pitch: 0,
		};
		const worldAhead = point<3>(10, DEFAULT_POSE.position[1]![0]!, 0);
		const projected = projectWorldPoint(worldAhead, pose, 800, 600);

		expect(projected).not.toBeNull();
		expect(projected![0]![0]!).toBeCloseTo(400, 5);
		expect(projected![1]![0]!).toBeCloseTo(300, 5);
	});

	test('looking up keeps the viewed forward point centred', () => {
		const pose = {
			...DEFAULT_POSE,
			position: point<3>(0, DEFAULT_POSE.position[1]![0]!, 0),
			yaw: Math.PI / 2,
			pitch: Math.PI / 6,
		};
		const forward = forwardFromPose(pose);
		const worldAhead = point<3>(
			pose.position[0]![0]! + forward[0]![0]! * 10,
			pose.position[1]![0]! + forward[1]![0]! * 10,
			pose.position[2]![0]! + forward[2]![0]! * 10,
		);
		const projected = projectWorldPoint(worldAhead, pose, 800, 600);

		expect(projected).not.toBeNull();
		expect(projected![0]![0]!).toBeCloseTo(400, 5);
		expect(projected![1]![0]!).toBeCloseTo(300, 5);
	});

	test('looking directly behind does not roll the viewport', () => {
		const pose = {
			...DEFAULT_POSE,
			position: point<3>(0, DEFAULT_POSE.position[1]![0]!, 0),
			yaw: Math.PI,
			pitch: 0,
		};
		const forward = forwardFromPose(pose);
		const worldAboveTarget = point<3>(
			pose.position[0]![0]! + forward[0]![0]! * 10,
			pose.position[1]![0]! + 5,
			pose.position[2]![0]! + forward[2]![0]! * 10,
		);
		const projected = projectWorldPoint(worldAboveTarget, pose, 800, 600);

		expect(projected).not.toBeNull();
		expect(projected![0]![0]!).toBeCloseTo(400, 5);
		expect(projected![1]![0]!).toBeLessThan(300);
	});
});
