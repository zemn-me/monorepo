import {
	forwardFromPose as cameraForwardFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import {
	Point2D,
	Point3D,
	point,
	scale,
	translate,
	x,
	z,
} from '#root/ts/math/cartesian.js';
import { defaultUp } from '#root/ts/math/lookAt.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import {
	perspective,
	projectCameraPoint,
	projectWorldPoint as projectProjectedWorldPoint,
	type RenderedSegment2D,
	renderSegments,
	type StyledSegment3D,
} from '#root/ts/math/wireframe_render.js';
import { type Result, unwrap } from '#root/ts/result/result.js';

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

export function forwardFromPose(
	pose: Pick<PlayerPose, 'yaw' | 'pitch'>
): Result<Point3D, Error> {
	return cameraForwardFromPose(pose);
}

export function stepPlayer(
	pose: PlayerPose,
	input: MovementInput,
	deltaSeconds: number
): PlayerPose {
	const yawRotation = unwrap(Quaternion.fromAxisAngle(defaultUp, pose.yaw));
	const forward = horizontalUnit(
		unwrap(Quaternion.rotateVector(yawRotation, DEFAULT_FORWARD))
	);
	const right = horizontalUnit(
		unwrap(Quaternion.rotateVector(yawRotation, DEFAULT_RIGHT))
	);
	const requested: Point3D = translate(
		scale(forward, input.forward),
		scale(right, input.strafe)
	) as Point3D;
	const moveDirection = horizontalUnit(requested);
	const speed = input.sprint ? 10 : 5;
	const movement: Point3D = scale(
		moveDirection,
		speed * deltaSeconds
	) as Point3D;
	const onGround = pose.position[1]![0]! <= EYE_HEIGHT + 1e-6;
	const jumpVelocity =
		input.jump && onGround ? JUMP_VELOCITY : pose.verticalVelocity;
	const nextVerticalVelocity = jumpVelocity - GRAVITY * deltaSeconds;
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
			Math.max(
				-ARENA_EXTENT + 1,
				Math.min(ARENA_EXTENT - 1, x(unclamped))
			),
			nextY,
			Math.max(
				-ARENA_EXTENT + 1,
				Math.min(ARENA_EXTENT - 1, z(unclamped))
			)
		),
		verticalVelocity: landed ? 0 : nextVerticalVelocity,
	};
}

export function projectPoint(
	cameraPoint: Point3D,
	width: number,
	height: number
): Point2D {
	return projectCameraPoint(cameraPoint, perspective(width, height));
}

export function projectWorldPoint(
	worldPoint: Point3D,
	pose: PlayerPose,
	width: number,
	height: number
): Result<Point2D | null, Error> {
	return projectProjectedWorldPoint(
		worldPoint,
		pose,
		perspective(width, height)
	);
}

export function renderScene(
	scene: readonly WorldSegment[],
	pose: PlayerPose,
	width: number,
	height: number
): Result<RenderedSegment[], Error> {
	return renderSegments(scene, pose, perspective(width, height));
}
