import {
	forwardFromPose as cameraForwardFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { point, Point2D, Point3D, scale, translate, x, z } from '#root/ts/math/cartesian.js';
import { defaultUp, lookAt } from '#root/ts/math/lookAt.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { unwrap, type Result } from '#root/ts/result/result.js';
import { box, pyramid, rigidTransform, type Segment3D } from '#root/ts/math/wireframe.js';
import {
	perspective,
	projectCameraPoint,
	projectWorldPoint as projectProjectedWorldPoint,
	type RenderedSegment2D,
	renderSegments,
	type StyledSegment3D,
	styleSegment,
} from '#root/ts/math/wireframe_render.js';

export interface PlayerPose extends YawPitchPose {
	readonly verticalVelocity: number;
}

export interface MovementInput {
	readonly forward: number;
	readonly strafe: number;
	readonly sprint: boolean;
	readonly jump: boolean;
}

export type WorldSegment = StyledSegment3D;

export type RenderedSegment = RenderedSegment2D;

export const ARENA_EXTENT = 24;
export const EYE_HEIGHT = 1.8;
export const JUMP_VELOCITY = 6.5;
export const GRAVITY = 18;
export const DEFAULT_POSE: PlayerPose = {
	position: point<3>(0, EYE_HEIGHT, -18),
	yaw: 0,
	pitch: 0,
	verticalVelocity: 0,
};

const DEFAULT_FORWARD = point<3>(0, 0, 1);
const DEFAULT_RIGHT = point<3>(1, 0, 0);

function horizontalUnit(point3d: Point3D): Point3D {
	const dx = x(point3d);
	const dz = z(point3d);
	const length = Math.hypot(dx, dz);

	if (length === 0) {
		return point<3>(0, 0, 0);
	}

	return point<3>(dx / length, 0, dz / length);
}

export function forwardFromPose(pose: Pick<PlayerPose, 'yaw' | 'pitch'>): Result<Point3D, Error> {
	return cameraForwardFromPose(pose);
}

export function stepPlayer(
	pose: PlayerPose,
	input: MovementInput,
	deltaSeconds: number
): PlayerPose {
	const yawRotation = unwrap(Quaternion.fromAxisAngle(defaultUp, pose.yaw));
	const forward = horizontalUnit(unwrap(Quaternion.rotateVector(yawRotation, DEFAULT_FORWARD)));
	const right = horizontalUnit(unwrap(Quaternion.rotateVector(yawRotation, DEFAULT_RIGHT)));
	const requested: Point3D = translate(
		scale(forward, input.forward),
		scale(right, input.strafe)
	) as Point3D;
	const moveDirection = horizontalUnit(requested);
	const speed = input.sprint ? 10 : 5;
	const movement: Point3D = scale(moveDirection, speed * deltaSeconds) as Point3D;
	const onGround = pose.position[1]![0]! <= EYE_HEIGHT + 1e-6;
	const jumpVelocity = input.jump && onGround ? JUMP_VELOCITY : pose.verticalVelocity;
	const nextVerticalVelocity = jumpVelocity - (GRAVITY * deltaSeconds);
	const verticalMovement = jumpVelocity * deltaSeconds;
	const unclamped: Point3D = translate(
		pose.position,
		translate(movement, point<3>(0, verticalMovement, 0)) as Point3D
	) as Point3D;
	const nextY = Math.max(EYE_HEIGHT, unclamped[1]![0]!);
	const landed = nextY === EYE_HEIGHT && nextVerticalVelocity < 0;

	return {
		...pose,
		position: point<3>(
			Math.max(-ARENA_EXTENT + 1, Math.min(ARENA_EXTENT - 1, x(unclamped))),
			nextY,
			Math.max(-ARENA_EXTENT + 1, Math.min(ARENA_EXTENT - 1, z(unclamped)))
		),
		verticalVelocity: landed ? 0 : nextVerticalVelocity,
	};
}

function applyTransform(
	segments: readonly Segment3D[],
	rotation: Quaternion.Quaternion,
	translation: Point3D,
	stroke: string,
	width: number,
	opacity: number
): WorldSegment[] {
	return unwrap(rigidTransform(segments, rotation, translation)).map(
		([start, end]) => styleSegment([start, end], { stroke, width, opacity })
	);
}

function worldSegment(
	start: Point3D,
	end: Point3D,
	stroke: string,
	width: number,
	opacity: number
): WorldSegment {
	return styleSegment([start, end], { stroke, width, opacity });
}

export function createArenaScene(): WorldSegment[] {
	const scene: WorldSegment[] = [];

	for (let row = -ARENA_EXTENT; row <= ARENA_EXTENT; row += 2) {
		const major = row % 8 === 0;
		scene.push(
			worldSegment(
				point<3>(-ARENA_EXTENT, 0, row),
				point<3>(ARENA_EXTENT, 0, row),
				major ? '#8abf5a' : '#47683a',
				major ? 1.25 : 0.7,
				major ? 0.75 : 0.45
			)
		);
		scene.push(
			worldSegment(
				point<3>(row, 0, -ARENA_EXTENT),
				point<3>(row, 0, ARENA_EXTENT),
				major ? '#8abf5a' : '#47683a',
				major ? 1.25 : 0.7,
				major ? 0.75 : 0.45
			)
		);
	}

	const wallColor = '#d9c07d';
	const wallHeight = 6;
	scene.push(
		...applyTransform(
			box(ARENA_EXTENT * 2, wallHeight, 0.4),
			Quaternion.from(0, 0, 0, 1),
			point<3>(0, wallHeight / 2, -ARENA_EXTENT),
			wallColor,
			1.6,
			0.85
		),
		...applyTransform(
			box(ARENA_EXTENT * 2, wallHeight, 0.4),
			Quaternion.from(0, 0, 0, 1),
			point<3>(0, wallHeight / 2, ARENA_EXTENT),
			wallColor,
			1.6,
			0.85
		),
		...applyTransform(
			box(0.4, wallHeight, ARENA_EXTENT * 2),
			Quaternion.from(0, 0, 0, 1),
			point<3>(-ARENA_EXTENT, wallHeight / 2, 0),
			wallColor,
			1.6,
			0.85
		),
		...applyTransform(
			box(0.4, wallHeight, ARENA_EXTENT * 2),
			Quaternion.from(0, 0, 0, 1),
			point<3>(ARENA_EXTENT, wallHeight / 2, 0),
			wallColor,
			1.6,
			0.85
		),
	);

	const plinths = [
		point<3>(0, 1.4, -10),
		point<3>(10, 1.4, 0),
		point<3>(0, 1.4, 10),
		point<3>(-10, 1.4, 0),
	];
	for (const plinth of plinths) {
		scene.push(
			...applyTransform(
				box(3, 2.8, 3),
				Quaternion.from(0, 0, 0, 1),
				plinth,
				'#8d7352',
				1.4,
				0.8
			)
		);
	}

	const pyramids = [
		{
			direction: point<3>(0, 0, 1),
			position: point<3>(0, 4.1, -10),
			stroke: '#9fe870',
		},
		{
			direction: point<3>(1, 0, 0),
			position: point<3>(10, 4.1, 0),
			stroke: '#ffcf70',
		},
		{
			direction: point<3>(0, 0, -1),
			position: point<3>(0, 4.1, 10),
			stroke: '#ff8c69',
		},
		{
			direction: point<3>(-1, 0, 0),
			position: point<3>(-10, 4.1, 0),
			stroke: '#7dd6ff',
		},
	];

	for (const marker of pyramids) {
		scene.push(
			...applyTransform(
				pyramid(2.2, 2.8),
				unwrap(lookAt(point<3>(0, 0, 0), marker.direction, defaultUp)),
				marker.position,
				marker.stroke,
				1.7,
				0.95
			)
		);
	}

	for (const position of [
		point<3>(-8, 1.5, -8),
		point<3>(8, 1.5, -8),
		point<3>(8, 1.5, 8),
		point<3>(-8, 1.5, 8),
	]) {
		scene.push(
			...applyTransform(
				box(2.6, 3, 2.6),
				Quaternion.from(0, 0, 0, 1),
				position,
				'#5cb0d6',
				1.2,
				0.75
			)
		);
	}

	return scene;
}

export function projectPoint(cameraPoint: Point3D, width: number, height: number): Point2D {
	return projectCameraPoint(cameraPoint, perspective(width, height));
}

export function projectWorldPoint(
	worldPoint: Point3D,
	pose: PlayerPose,
	width: number,
	height: number
): Result<Point2D | null, Error> {
	return projectProjectedWorldPoint(worldPoint, pose, perspective(width, height));
}

export function renderScene(
	scene: readonly WorldSegment[],
	pose: PlayerPose,
	width: number,
	height: number
): Result<RenderedSegment[], Error> {
	return renderSegments(scene, pose, perspective(width, height));
}
