import { describe, expect, test } from '@jest/globals';

import {
	initialMovementKeys,
	lookAngleDeltaFromJoystick,
	movementInputFromControls,
	normalizeJoystickOffset,
} from '#root/ts/joystick/index.js';

describe('joystick helpers', () => {
	test('normalizes joystick offsets to the configured radius', () => {
		expect(normalizeJoystickOffset(10, 0, 20)).toEqual({ x: 0.5, y: 0 });
		expect(normalizeJoystickOffset(80, 0, 20)).toEqual({ x: 1, y: 0 });
		expect(normalizeJoystickOffset(0, -80, 20)).toEqual({ x: 0, y: -1 });
	});

	test('combines keyboard and joystick movement with forward mapped upward', () => {
		const keys = initialMovementKeys();
		const input = movementInputFromControls(
			{
				...keys,
				KeyD: true,
			},
			{ x: -0.25, y: -0.75 },
			false
		);

		expect(input).toEqual({
			forward: 0.75,
			strafe: 0.75,
			sprint: false,
			jump: false,
		});
	});

	test('defaults jump to the space key and scales look deltas by time', () => {
		const keys = {
			...initialMovementKeys(),
			Space: true,
		};

		expect(movementInputFromControls(keys, { x: 0, y: 0 })).toEqual({
			forward: 0,
			strafe: 0,
			sprint: false,
			jump: true,
		});
		expect(lookAngleDeltaFromJoystick({ x: 0.5, y: -0.25 }, 0.2, 2)).toEqual({
			x: 0.2,
			y: -0.1,
		});
	});
});
