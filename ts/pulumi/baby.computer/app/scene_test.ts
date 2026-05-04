import { describe, expect, test } from '@jest/globals';

import { point } from '#root/ts/math/cartesian.js';
import {
	createPenguinWorld,
	nearestPenguin,
	nearestVisiblePenguin,
} from '#root/ts/pulumi/baby.computer/app/scene.js';

describe('baby.computer scene', () => {
	test('creates a populated penguin world', () => {
		const world = createPenguinWorld();

		expect(world.scene.length).toBeGreaterThan(120);
		expect(world.penguins).toHaveLength(16);
		expect(world.penguinBodies).toHaveLength(16);
		expect(world.startPose.position[1]![0]!).toBeGreaterThan(1);
	});

	test('heavier penguins are taller', () => {
		const world = createPenguinWorld();
		const sorted = [...world.penguins].sort(
			(left, right) => left.massKg - right.massKg
		);

		expect(sorted[0]!.heightM).toBeLessThan(sorted.at(-1)!.heightM);
		expect(sorted.at(-1)!.name).toBe('Wobble');
	});

	test('finds the nearest penguin by horizontal distance', () => {
		const world = createPenguinWorld();
		const nearest = nearestPenguin(world.penguins, point<3>(0.9, 0, 2.7));

		expect(nearest).not.toBeNull();
		expect(nearest!.name).toBe('Aunt Sleet');
		expect(nearest!.distance).toBeLessThan(0.6);
	});

	test('prefers the nearest penguin that is actually visible in the viewport', () => {
		const world = createPenguinWorld();
		const visible = nearestVisiblePenguin(
			[
				{
					name: 'Behind You',
					species: 'Adelie',
					blurb: 'Out of frame.',
					massKg: 4.5,
					heightM: 0.7,
					position: point<3>(0, 0, -22.5),
				},
				{
					name: 'In Front',
					species: 'Gentoo',
					blurb: 'Clearly visible.',
					massKg: 6.5,
					heightM: 0.82,
					position: point<3>(0, 0, -8),
				},
			],
			world.startPose,
			1200,
			800
		);

		expect(visible).not.toBeNull();
		expect(visible!.penguin.name).toBe('In Front');
	});
});
