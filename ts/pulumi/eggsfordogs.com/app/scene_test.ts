import { describe, expect, test } from '@jest/globals';
import {
	callPack,
	createPark,
	PACK,
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
			expect(Math.hypot(dog.x, dog.z)).toBeLessThan(2);
		for (let frame = 0; frame < 240; frame++) park = stepPark(park, 1 / 60);
		expect(park.time).toBeGreaterThan(park.callingUntil);
	});
	test('invalid throws and suspended frames cannot corrupt the simulation', () => {
		const park = createPark();
		expect(tossEgg(park, Number.NaN, 0)).toBe(park);
		expect(tossEgg(park, 0, Number.POSITIVE_INFINITY)).toBe(park);
		expect(stepPark(park, 100).time).toBe(0.05);
		expect(stepPark(park, -1).time).toBe(0);
	});
});
