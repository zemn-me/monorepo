import { describe, expect, test } from '@jest/globals';

import { point } from '#root/ts/math/cartesian.js';
import {
	createPenguinWorld,
	nearestPenguin,
} from '#root/ts/pulumi/baby.computer/app/scene.js';

describe('baby.computer scene', () => {
	test('creates a populated penguin world', () => {
		const world = createPenguinWorld();

		expect(world.scene.length).toBeGreaterThan(40);
		expect(world.penguins).toHaveLength(5);
		expect(world.penguinBodies).toHaveLength(5);
		expect(world.startPose.position[1]![0]!).toBeGreaterThan(1);
	});

	test('finds the nearest penguin by horizontal distance', () => {
		const world = createPenguinWorld();
		const nearest = nearestPenguin(world.penguins, point<3>(0.9, 0, 2.7));

		expect(nearest).not.toBeNull();
		expect(nearest!.name).toBe('Aunt Sleet');
		expect(nearest!.distance).toBeLessThan(1);
	});
});
