export interface MovementKeyState {
	readonly KeyW: boolean;
	readonly KeyA: boolean;
	readonly KeyS: boolean;
	readonly KeyD: boolean;
	readonly Space: boolean;
	readonly ShiftLeft: boolean;
	readonly ShiftRight: boolean;
}

export interface JoystickInput {
	readonly x: number;
	readonly y: number;
}

export interface MovementControlInput {
	readonly forward: number;
	readonly strafe: number;
	readonly sprint: boolean;
	readonly jump: boolean;
}

function clampAxis(value: number): number {
	return Math.max(-1, Math.min(1, value));
}

export function initialMovementKeys(): MovementKeyState {
	return {
		KeyW: false,
		KeyA: false,
		KeyS: false,
		KeyD: false,
		Space: false,
		ShiftLeft: false,
		ShiftRight: false,
	};
}

export function normalizeJoystickOffset(
	offsetX: number,
	offsetY: number,
	radius: number
): JoystickInput {
	if (radius <= 0) {
		return { x: 0, y: 0 };
	}

	const distance = Math.hypot(offsetX, offsetY);
	if (distance === 0) {
		return { x: 0, y: 0 };
	}

	const limitedDistance = Math.min(distance, radius);
	const scale = limitedDistance / distance;
	return {
		x: clampAxis((offsetX * scale) / radius),
		y: clampAxis((offsetY * scale) / radius),
	};
}

export function movementInputFromControls(
	keys: MovementKeyState,
	joystick: JoystickInput,
	jump = keys.Space
): MovementControlInput {
	return {
		forward: clampAxis(Number(keys.KeyW) - Number(keys.KeyS) - joystick.y),
		strafe: clampAxis(Number(keys.KeyD) - Number(keys.KeyA) + joystick.x),
		sprint: keys.ShiftLeft || keys.ShiftRight,
		jump,
	};
}

export function lookAngleDeltaFromJoystick(
	joystick: JoystickInput,
	deltaSeconds: number,
	radiansPerSecond: number
): JoystickInput {
	return {
		x: joystick.x * radiansPerSecond * deltaSeconds,
		y: joystick.y * radiansPerSecond * deltaSeconds,
	};
}
