import { describe, expect, test } from '@jest/globals';
import {
	callPack,
	createPark,
	dogCollisionRadius,
	PACK,
	type Park,
	stepPark,
	tossEgg,
} from '#root/ts/pulumi/eggsfordogs.com/app/scene.js';

describe('the dog park', () => {
	test('the pack retrieves a tossed egg exactly once', () => {
		let park = tossEgg(createPark(), 3, 2);
		for (let frame = 0; frame < 600; frame++) park = stepPark(park, 1 / 60);
		expect(park.delivered).toBe(1);
		expect(park.eggs).toHaveLength(0);
		expect(park.lastDog).not.toBeNull();
	});
	test('all eggs in a batch can be delivered, including at the lawn boundary', () => {
		let park = createPark();
		for (let i = 0; i < 12; i++)
			park = tossEgg(park, Math.cos(i) * 40, Math.sin(i) * 40);
		expect(tossEgg(park, 0, 0)).toBe(park);
		for (const egg of park.eggs)
			expect(Math.hypot(egg.x, egg.z)).toBeLessThanOrEqual(5.800001);
		for (let frame = 0; frame < 3600; frame++)
			park = stepPark(park, 1 / 60);
		expect(park.delivered).toBe(12);
		expect(park.eggs).toHaveLength(0);
	});
	test('calling gathers every dog and expires naturally', () => {
		let park = callPack(createPark());
		for (let frame = 0; frame < 240; frame++) park = stepPark(park, 1 / 60);
		expect(park.dogs).toHaveLength(PACK.length);
		for (const dog of park.dogs)
			expect(Math.hypot(dog.x, dog.z)).toBeLessThan(2.7);
		for (let frame = 0; frame < 240; frame++) park = stepPark(park, 1 / 60);
		expect(park.time).toBeGreaterThan(park.callingUntil);
	});
	test.each([1 / 60, 1 / 20])(
		'dogs stay separated while gathering and retrieving clustered eggs at dt=%s',
		dt => {
			let park = callPack(createPark());
			let clearance = minimumClearance(park);
			for (let i = 0; i < 12; i++) park = tossEgg(park, 0, 0);
			for (let frame = 0; frame < 30 / dt; frame++) {
				park = stepPark(park, dt);
				clearance = Math.min(clearance, minimumClearance(park));
			}
			expect(clearance).toBeGreaterThanOrEqual(-0.00002);
			expect(park.delivered).toBe(12);
			expect(park.eggs).toHaveLength(0);
		}
	);

	test('coincident dogs separate deterministically and stay on the island', () => {
		const park = callPack(createPark());
		park.dogs = park.dogs.map(dog => ({ ...dog, x: 6.2, z: 0 }));
		const original = structuredClone(park);
		const next = stepPark(park, 1 / 30);
		expect(next).toEqual(stepPark(park, 1 / 30));
		expect(park).toEqual(original);
		expect(minimumClearance(next)).toBeGreaterThanOrEqual(-0.00002);
		for (const dog of next.dogs) {
			expect(Number.isFinite(dog.heading)).toBe(true);
			expect(Math.hypot(dog.x, dog.z)).toBeLessThanOrEqual(6.200001);
		}
	});

	test('invalid throws and suspended frames cannot corrupt the simulation', () => {
		const park = createPark();
		expect(tossEgg(park, Number.NaN, 0)).toBe(park);
		expect(tossEgg(park, 0, Number.POSITIVE_INFINITY)).toBe(park);
		expect(stepPark(park, 100).time).toBe(0.05);
		expect(stepPark(park, -1).time).toBe(0);
	});
});

function minimumClearance(park: Park): number {
	let clearance = Infinity;
	for (let i = 0; i < park.dogs.length; i++)
		for (let j = i + 1; j < park.dogs.length; j++) {
			const a = park.dogs[i]!,
				b = park.dogs[j]!;
			clearance = Math.min(
				clearance,
				Math.hypot(a.x - b.x, a.z - b.z) -
					dogCollisionRadius(i) -
					dogCollisionRadius(j)
			);
		}
	return clearance;
}
