import {
	forwardFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { point, Point3D, scale, translate, x, z } from '#root/ts/math/cartesian.js';
import { defaultUp } from '#root/ts/math/lookAt.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { type StyledSegment3D, styleSegment } from '#root/ts/math/wireframe_render.js';
import { and_then, type Result, unwrap } from '#root/ts/result/result.js';

export interface PlayerPose extends YawPitchPose {
	readonly verticalVelocity: number;
}

export interface MovementInput {
	readonly forward: number;
	readonly strafe: number;
	readonly sprint: boolean;
	readonly jump: boolean;
}

export enum ParticleType {
	Egg,
	Dog,
}

export type Particle = {
	readonly id: string;
	readonly type: ParticleType;
	readonly position: Point3D;
	readonly velocity: Point3D;
	readonly phase: number;
};

export interface World {
	readonly scene: StyledSegment3D[];
	readonly critters: Particle[];
}

export const ARENA_LIMIT = 31;
export const EYE_HEIGHT = 1.8;
export const DEFAULT_POSE: PlayerPose = {
	position: point<3>(0, EYE_HEIGHT, -18),
	yaw: 0,
	pitch: 0,
	verticalVelocity: 0,
};

const DEFAULT_FORWARD = point<3>(0, 0, 1);
const DEFAULT_RIGHT = point<3>(1, 0, 0);
const PITCH_LIMIT = Math.PI * 0.45;

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function horizontalUnit(vec: Point3D): Point3D {
	const len = Math.hypot(x(vec), z(vec));
	if (len === 0) return point<3>(0, 0, 0);
	return point<3>(x(vec) / len, 0, z(vec) / len);
}

function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (1664525 * state + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function keepInYard(position: Point3D, velocity: Point3D): {
	readonly position: Point3D;
	readonly velocity: Point3D;
} {
	let px = x(position);
	let pz = z(position);
	let vx = x(velocity);
	let vz = z(velocity);

	if (Math.abs(px) > ARENA_LIMIT) {
		px = clamp(px, -ARENA_LIMIT, ARENA_LIMIT);
		vx *= -0.82;
	}

	if (Math.abs(pz) > ARENA_LIMIT) {
		pz = clamp(pz, -ARENA_LIMIT, ARENA_LIMIT);
		vz *= -0.82;
	}

	return {
		position: point<3>(px, 0, pz),
		velocity: point<3>(vx, 0, vz),
	};
}

export function clampPitch(pitch: number): number {
	return clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
}

export function stepLook(
	pose: PlayerPose,
	movementX: number,
	movementY: number,
	sensitivity = 0.0025
): PlayerPose {
	return {
		...pose,
		yaw: pose.yaw + (movementX * sensitivity),
		pitch: clampPitch(pose.pitch + (movementY * sensitivity)),
	};
}

export function stepPlayer(
	pose: PlayerPose,
	input: MovementInput,
	deltaSeconds: number
): PlayerPose {
	const yawRotation = unwrap(Quaternion.fromAxisAngle(defaultUp, pose.yaw));
	const forward = horizontalUnit(unwrap(Quaternion.rotateVector(yawRotation, DEFAULT_FORWARD)));
	const right = horizontalUnit(unwrap(Quaternion.rotateVector(yawRotation, DEFAULT_RIGHT)));
	const requested = translate(scale(forward, input.forward), scale(right, input.strafe)) as Point3D;
	const movement = scale(horizontalUnit(requested), (input.sprint ? 10 : 5) * deltaSeconds) as Point3D;
	const onGround = pose.position[1]![0]! <= EYE_HEIGHT + 0.000001;
	const jumpVelocity = input.jump && onGround ? 6.5 : pose.verticalVelocity;
	const nextVerticalVelocity = jumpVelocity - (18 * deltaSeconds);
	const verticalMovement = jumpVelocity * deltaSeconds;
	const unclamped = translate(
		pose.position,
		translate(movement, point<3>(0, verticalMovement, 0)) as Point3D
	) as Point3D;
	const nextY = Math.max(EYE_HEIGHT, unclamped[1]![0]!);
	const landed = nextY === EYE_HEIGHT && nextVerticalVelocity < 0;

	return {
		...pose,
		position: point<3>(
			clamp(x(unclamped), -ARENA_LIMIT, ARENA_LIMIT),
			nextY,
			clamp(z(unclamped), -ARENA_LIMIT, ARENA_LIMIT)
		),
		verticalVelocity: landed ? 0 : nextVerticalVelocity,
	};
}

export function buildWorld(): World {
	const scene: StyledSegment3D[] = [];
	for (let row = -32; row <= 32; row += 2) {
		scene.push(
			styleSegment([point<3>(-32, 0, row), point<3>(32, 0, row)], { stroke: '#6f8f54', width: 0.75, opacity: 0.42 }),
			styleSegment([point<3>(row, 0, -32), point<3>(row, 0, 32)], { stroke: '#9d8150', width: 0.55, opacity: 0.26 })
		);
	}
	for (const radius of [12, 22, 31]) {
		scene.push(
			styleSegment([point<3>(-radius, 0.02, -radius), point<3>(radius, 0.02, -radius)], { stroke: '#f4d47f', width: 1.25, opacity: 0.48 }),
			styleSegment([point<3>(radius, 0.02, -radius), point<3>(radius, 0.02, radius)], { stroke: '#f4d47f', width: 1.25, opacity: 0.48 }),
			styleSegment([point<3>(radius, 0.02, radius), point<3>(-radius, 0.02, radius)], { stroke: '#f4d47f', width: 1.25, opacity: 0.48 }),
			styleSegment([point<3>(-radius, 0.02, radius), point<3>(-radius, 0.02, -radius)], { stroke: '#f4d47f', width: 1.25, opacity: 0.48 })
		);
	}

	const rng = seededRandom(0x600d_e99);
	const critters: Particle[] = [];
	for (let i = 0; i < 55; i += 1) {
		const angle = rng() * Math.PI * 2;
		critters.push({
			id: `egg-${i}`,
			type: ParticleType.Egg,
			position: point<3>((rng() * 56) - 28, 0, (rng() * 56) - 28),
			velocity: point<3>(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35),
			phase: rng() * Math.PI * 2,
		});
	}
	for (let i = 0; i < 8; i += 1) {
		const angle = rng() * Math.PI * 2;
		critters.push({
			id: `dog-${i}`,
			type: ParticleType.Dog,
			position: point<3>((rng() * 56) - 28, 0, (rng() * 56) - 28),
			velocity: point<3>(Math.cos(angle) * 1.6, 0, Math.sin(angle) * 1.6),
			phase: rng() * Math.PI * 2,
		});
	}

	return { scene, critters };
}

export function stepCritters(
	critters: readonly Particle[],
	deltaSeconds: number,
	timeSeconds: number
): Particle[] {
	const eggs = critters.filter(critter => critter.type === ParticleType.Egg);
	const eggCentre = eggs.length === 0
		? point<3>(0, 0, 0)
		: point<3>(
			eggs.reduce((total, egg) => total + x(egg.position), 0) / eggs.length,
			0,
			eggs.reduce((total, egg) => total + z(egg.position), 0) / eggs.length
		);

	return critters.map(critter => {
		const wander = point<3>(
			Math.cos(timeSeconds * 1.7 + critter.phase),
			0,
			Math.sin(timeSeconds * 1.3 + critter.phase * 1.37)
		);
		const dogPush = critter.type === ParticleType.Egg
			? critters
				.filter(other => other.type === ParticleType.Dog)
				.reduce((push, dog) => {
					const away = point<3>(
						x(critter.position) - x(dog.position),
						0,
						z(critter.position) - z(dog.position)
					);
					const distance = Math.max(1, Math.hypot(x(away), z(away)));
					if (distance > 7) return push;
					return translate(push, scale(horizontalUnit(away), (7 - distance) * 1.5)) as Point3D;
				}, point<3>(0, 0, 0))
			: point<3>(0, 0, 0);
		const toEggs = critter.type === ParticleType.Dog
			? scale(horizontalUnit(point<3>(
				x(eggCentre) - x(critter.position),
				0,
				z(eggCentre) - z(critter.position)
			)), 2.6)
			: point<3>(0, 0, 0);
		const acceleration = translate(
			scale(wander, critter.type === ParticleType.Egg ? 0.9 : 1.2),
			translate(dogPush, toEggs) as Point3D
		) as Point3D;
		const damping = critter.type === ParticleType.Egg ? 0.9 : 0.82;
		const maxSpeed = critter.type === ParticleType.Egg ? 2.7 : 4.4;
		const nextVelocity = scale(
			translate(critter.velocity, scale(acceleration, deltaSeconds)) as Point3D,
			Math.pow(damping, deltaSeconds)
		) as Point3D;
		const speed = Math.hypot(x(nextVelocity), z(nextVelocity));
		const limitedVelocity = speed > maxSpeed
			? scale(horizontalUnit(nextVelocity), maxSpeed) as Point3D
			: nextVelocity;
		const next = keepInYard(
			translate(critter.position, scale(limitedVelocity, deltaSeconds)) as Point3D,
			limitedVelocity
		);

		return {
			...critter,
			position: next.position,
			velocity: next.velocity,
		};
	});
}

export function isFacingPose(point3d: Point3D, pose: PlayerPose): Result<boolean, Error> {
	const dx = x(point3d) - x(pose.position);
	const dz = z(point3d) - z(pose.position);
	return and_then(
		forwardFromPose(pose),
		forward => (dx * x(forward)) + (dz * z(forward)) > 0
	);
}
