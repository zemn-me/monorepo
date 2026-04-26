import type { MovementInput } from '#root/project/zemn.me/app/experiments/arena/scene.js';

export interface JoystickVector {
	readonly x: number;
	readonly y: number;
}

function clampAxis(value: number): number {
	return Math.max(-1, Math.min(1, value));
}

export function mergeMovementInput(
	keyboard: MovementInput,
	joystick: JoystickVector
): MovementInput {
	return {
		forward: clampAxis(keyboard.forward - joystick.y),
		strafe: clampAxis(keyboard.strafe + joystick.x),
		sprint: keyboard.sprint,
		jump: keyboard.jump,
	};
}

