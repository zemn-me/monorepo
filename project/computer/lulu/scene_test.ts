import { describe, expect, test } from '@jest/globals';

import {
	AQUARIUM_DEPTH,
	AQUARIUM_HEIGHT,
	AQUARIUM_WIDTH,
	orbitCameraPose,
	particleWorldPoint,
	previewProjectedFaceCount,
	projectAquariumParticle,
	renderAquariumScene,
	SWIM_CEILING_Y,
	SWIM_FLOOR_Y,
	WATER_SURFACE_Y,
} from '#root/project/computer/lulu/scene.js';
import { cameraSpacePointFromPose } from '#root/ts/math/camera_pose.js';
import { point, x, y, z } from '#root/ts/math/cartesian.js';
import { unwrap } from '#root/ts/result/result.js';

describe('lulu.computer aquarium scene', () => {
	test('orbits the camera around the tank centre', () => {
		const pose = orbitCameraPose(Math.PI / 3);
		const target = point<3>(0, AQUARIUM_HEIGHT * 0.52, 0);
		const cameraPoint = unwrap(cameraSpacePointFromPose(target, pose));

		expect(x(cameraPoint)).toBeCloseTo(0, 5);
		expect(y(cameraPoint)).toBeCloseTo(0, 5);
		expect(z(cameraPoint)).toBeGreaterThan(15);
	});

	test('renders a cuboid tank with visible faces and frame segments', () => {
		const scene = renderAquariumScene(Math.PI / 5, 1200, 800);

		expect(scene.faces).toHaveLength(6);
		expect(previewProjectedFaceCount(Math.PI / 5)).toBe(6);
		expect(WATER_SURFACE_Y).toBeGreaterThan(AQUARIUM_HEIGHT * 0.9);
		expect(scene.segments.length).toBeGreaterThan(24);
		expect(
			scene.segments.every(
				segment =>
					Number.isFinite(segment.x1) &&
					Number.isFinite(segment.y1) &&
					Number.isFinite(segment.x2) &&
					Number.isFinite(segment.y2)
			)
		).toBe(true);
	});

	test('maps simulation coordinates into the aquarium volume', () => {
		const size = point<2>(1000, 1000);
		const low = particleWorldPoint('fish', point<2>(0, 0), size);
		const high = particleWorldPoint('fish', point<2>(1000, 1000), size);

		expect(x(low)).toBeCloseTo(-AQUARIUM_WIDTH * 0.45, 5);
		expect(y(low)).toBeCloseTo(SWIM_FLOOR_Y, 5);
		expect(x(high)).toBeCloseTo(AQUARIUM_WIDTH * 0.45, 5);
		expect(y(high)).toBeCloseTo(SWIM_CEILING_Y, 5);
		expect(y(high)).toBeLessThan(WATER_SURFACE_Y);
		expect(Math.abs(z(low))).toBeLessThanOrEqual(AQUARIUM_DEPTH * 0.39);
	});

	test('projects a particle into the viewport', () => {
		const size = point<2>(1000, 1000);
		const pose = orbitCameraPose(Math.PI / 4);
		const projected = projectAquariumParticle(
			'visible-fish',
			point<2>(500, 500),
			18,
			size,
			pose,
			1000,
			700
		);

		expect(projected).not.toBeNull();
		expect(projected!.x).toBeGreaterThan(0);
		expect(projected!.x).toBeLessThan(1000);
		expect(projected!.y).toBeGreaterThan(0);
		expect(projected!.y).toBeLessThan(700);
		expect(projected!.fontSize).toBeGreaterThan(9);
		expect(projected!.opacity).toBeGreaterThanOrEqual(0.5);
		expect(projected!.opacity).toBeLessThanOrEqual(1);
	});
});
