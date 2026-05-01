import { describe, expect, test } from '@jest/globals';

import { point, x, z } from '#root/ts/math/cartesian.js';
import {
	buildWorld,
	DEFAULT_POSE,
	ParticleType,
	stepCritters,
	stepLook,
	stepPlayer,
} from '#root/ts/pulumi/eggsfordogs.com/app/scene.js';

describe('eggsfordogs scene', () => {
	test('builds a populated moving yard', () => {
		const world = buildWorld();

		expect(world.scene.length).toBeGreaterThan(60);
		expect(world.critters.filter(critter => critter.type === ParticleType.Egg)).toHaveLength(55);
		expect(world.critters.filter(critter => critter.type === ParticleType.Dog)).toHaveLength(8);
	});

	test('mouse look follows the same signs as baby.computer', () => {
		const looked = stepLook(DEFAULT_POSE, 10, 10);

		expect(looked.yaw).toBeGreaterThan(DEFAULT_POSE.yaw);
		expect(looked.pitch).toBeGreaterThan(DEFAULT_POSE.pitch);
	});

	test('moving forward follows yaw', () => {
		const moved = stepPlayer(
			{ ...DEFAULT_POSE, yaw: Math.PI / 2 },
			{ forward: 1, strafe: 0, sprint: false, jump: false },
			1
		);

		expect(x(moved.position)).toBeGreaterThan(x(DEFAULT_POSE.position));
		expect(z(moved.position)).toBeCloseTo(z(DEFAULT_POSE.position), 5);
	});

	test('critters move over time and stay inside the yard', () => {
		const world = buildWorld();
		const stepped = stepCritters(world.critters, 1, 1);
		const changed = stepped.some((critter, index) =>
			x(critter.position) !== x(world.critters[index]!.position) ||
			z(critter.position) !== z(world.critters[index]!.position)
		);

		expect(changed).toBe(true);
		for (const critter of stepped) {
			expect(Math.abs(x(critter.position))).toBeLessThanOrEqual(31);
			expect(Math.abs(z(critter.position))).toBeLessThanOrEqual(31);
		}
	});

	test('dogs accelerate toward the egg centre', () => {
		const stepped = stepCritters([
			{
				id: 'egg',
				type: ParticleType.Egg,
				position: point<3>(10, 0, 0),
				velocity: point<3>(0, 0, 0),
				phase: 0,
			},
			{
				id: 'dog',
				type: ParticleType.Dog,
				position: point<3>(0, 0, 0),
				velocity: point<3>(0, 0, 0),
				phase: 0,
			},
		], 1, 0);

		const dog = stepped.find(critter => critter.id === 'dog')!;
		expect(x(dog.position)).toBeGreaterThan(0);
	});
});
