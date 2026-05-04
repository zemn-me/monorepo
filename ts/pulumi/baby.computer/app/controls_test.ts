import { describe, expect, test } from '@jest/globals';

import { mergeMovementInput } from '#root/ts/pulumi/baby.computer/app/controls.js';

describe('mergeMovementInput', () => {
	test('adds joystick axes to keyboard movement', () => {
		const merged = mergeMovementInput(
			{ forward: 1, jump: false, sprint: false, strafe: 0 },
			{ x: -0.4, y: -0.6 }
		);

		expect(merged.forward).toBeCloseTo(1);
		expect(merged.strafe).toBeCloseTo(-0.4);
	});

	test('clamps movement to valid range', () => {
		const merged = mergeMovementInput(
			{ forward: -1, jump: false, sprint: false, strafe: 1 },
			{ x: 0.9, y: 0.8 }
		);

		expect(merged.forward).toBe(-1);
		expect(merged.strafe).toBe(1);
	});
});
