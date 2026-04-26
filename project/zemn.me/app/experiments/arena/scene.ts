import { point, Point2D, Point3D, x, y, z } from '#root/ts/math/cartesian.js';
import * as DualQuaternion from '#root/ts/math/dual_quaternion.js';
import { defaultUp, lookAt } from '#root/ts/math/lookAt.js';
import { sub } from '#root/ts/math/matrix.js';
import * as Quaternion from '#root/ts/math/quaternion.js';

export interface PlayerPose {
	readonly position: Point3D;
	readonly yaw: number;
	readonly pitch: number;
}

export interface MovementInput {
	readonly forward: number;
	readonly strafe: number;
	readonly sprint: boolean;
}

export interface WorldSegment {
	readonly start: Point3D;
	readonly end: Point3D;
	readonly stroke: string;
	readonly width: number;
	readonly opacity: number;
}

export interface RenderedSegment {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
	readonly stroke: string;
	readonly width: number;
	readonly opacity: number;
	readonly depth: number;
}

export const ARENA_EXTENT = 24;
export const EYE_HEIGHT = 1.8;
export const DEFAULT_POSE: PlayerPose = {
	position: point<3>(0, EYE_HEIGHT, -18),
	yaw: 0,
	pitch: 0,
};

const DEFAULT_FORWARD = point<3>(0, 0, 1);
const DEFAULT_RIGHT = point<3>(1, 0, 0);
const NEAR_PLANE = 0.1;
const FAR_PLANE = 90;

function translatePoint(a: Point3D, b: Point3D): Point3D {
	return point<3>(x(a) + x(b), y(a) + y(b), z(a) + z(b));
}

function scalePoint(a: Point3D, scalar: number): Point3D {
	return point<3>(x(a) * scalar, y(a) * scalar, z(a) * scalar);
}

function horizontalUnit(point3d: Point3D): Point3D {
	const dx = x(point3d);
	const dz = z(point3d);
	const length = Math.hypot(dx, dz);

	if (length === 0) {
		return point<3>(0, 0, 0);
	}

	return point<3>(dx / length, 0, dz / length);
}

function orientationFromAngles(yaw: number, pitch: number): Quaternion.Quaternion {
	const yawRotation = Quaternion.fromAxisAngle(defaultUp, yaw);
	const rightAxis = Quaternion.rotateVector(yawRotation, DEFAULT_RIGHT);
	const pitchRotation = Quaternion.fromAxisAngle(rightAxis, pitch);

	return Quaternion.normalize(Quaternion.multiply(pitchRotation, yawRotation));
}

function viewOrientationFromPose(pose: Pick<PlayerPose, 'yaw' | 'pitch'>): Quaternion.Quaternion {
	return Quaternion.inverse(orientationFromAngles(pose.yaw, pose.pitch));
}

export function forwardFromPose(pose: Pick<PlayerPose, 'yaw' | 'pitch'>): Point3D {
	return Quaternion.rotateVector(
		orientationFromAngles(pose.yaw, pose.pitch),
		DEFAULT_FORWARD
	);
}

export function stepPlayer(
	pose: PlayerPose,
	input: MovementInput,
	deltaSeconds: number
): PlayerPose {
	const yawRotation = Quaternion.fromAxisAngle(defaultUp, pose.yaw);
	const forward = horizontalUnit(Quaternion.rotateVector(yawRotation, DEFAULT_FORWARD));
	const right = horizontalUnit(Quaternion.rotateVector(yawRotation, DEFAULT_RIGHT));
	const requested = translatePoint(
		scalePoint(forward, input.forward),
		scalePoint(right, input.strafe)
	);
	const moveDirection = horizontalUnit(requested);
	const speed = input.sprint ? 10 : 5;
	const movement = scalePoint(moveDirection, speed * deltaSeconds);
	const unclamped = translatePoint(pose.position, movement);

	return {
		...pose,
		position: point<3>(
			Math.max(-ARENA_EXTENT + 1, Math.min(ARENA_EXTENT - 1, x(unclamped))),
			EYE_HEIGHT,
			Math.max(-ARENA_EXTENT + 1, Math.min(ARENA_EXTENT - 1, z(unclamped)))
		),
	};
}

function boxSegments(width: number, height: number, depth: number): readonly [Point3D, Point3D][] {
	const hw = width / 2;
	const hh = height / 2;
	const hd = depth / 2;

	const corners = {
		lbf: point<3>(-hw, -hh, hd),
		rbf: point<3>(hw, -hh, hd),
		ltf: point<3>(-hw, hh, hd),
		rtf: point<3>(hw, hh, hd),
		lbb: point<3>(-hw, -hh, -hd),
		rbb: point<3>(hw, -hh, -hd),
		ltb: point<3>(-hw, hh, -hd),
		rtb: point<3>(hw, hh, -hd),
	};

	return [
		[corners.lbf, corners.rbf],
		[corners.rbf, corners.rbb],
		[corners.rbb, corners.lbb],
		[corners.lbb, corners.lbf],
		[corners.ltf, corners.rtf],
		[corners.rtf, corners.rtb],
		[corners.rtb, corners.ltb],
		[corners.ltb, corners.ltf],
		[corners.lbf, corners.ltf],
		[corners.rbf, corners.rtf],
		[corners.rbb, corners.rtb],
		[corners.lbb, corners.ltb],
	] as const;
}

function pyramidSegments(base: number, length: number): readonly [Point3D, Point3D][] {
	const half = base / 2;
	const tip = point<3>(0, 0, length);
	const a = point<3>(-half, -half, 0);
	const b = point<3>(half, -half, 0);
	const c = point<3>(half, half, 0);
	const d = point<3>(-half, half, 0);

	return [
		[a, b],
		[b, c],
		[c, d],
		[d, a],
		[a, tip],
		[b, tip],
		[c, tip],
		[d, tip],
	] as const;
}

function applyTransform(
	segments: readonly (readonly [Point3D, Point3D])[],
	rotation: Quaternion.Quaternion,
	translation: Point3D,
	stroke: string,
	width: number,
	opacity: number
): WorldSegment[] {
	const transform = DualQuaternion.fromRotationTranslation(rotation, translation);

	return segments.map(([start, end]) => ({
		start: DualQuaternion.transformPoint(transform, start),
		end: DualQuaternion.transformPoint(transform, end),
		stroke,
		width,
		opacity,
	}));
}

export function createArenaScene(): WorldSegment[] {
	const scene: WorldSegment[] = [];

	for (let row = -ARENA_EXTENT; row <= ARENA_EXTENT; row += 2) {
		const major = row % 8 === 0;
		scene.push({
			start: point<3>(-ARENA_EXTENT, 0, row),
			end: point<3>(ARENA_EXTENT, 0, row),
			stroke: major ? '#8abf5a' : '#47683a',
			width: major ? 1.25 : 0.7,
			opacity: major ? 0.75 : 0.45,
		});
		scene.push({
			start: point<3>(row, 0, -ARENA_EXTENT),
			end: point<3>(row, 0, ARENA_EXTENT),
			stroke: major ? '#8abf5a' : '#47683a',
			width: major ? 1.25 : 0.7,
			opacity: major ? 0.75 : 0.45,
		});
	}

	const wallColor = '#d9c07d';
	const wallHeight = 6;
	scene.push(
		...applyTransform(
			boxSegments(ARENA_EXTENT * 2, wallHeight, 0.4),
			Quaternion.from(0, 0, 0, 1),
			point<3>(0, wallHeight / 2, -ARENA_EXTENT),
			wallColor,
			1.6,
			0.85
		),
		...applyTransform(
			boxSegments(ARENA_EXTENT * 2, wallHeight, 0.4),
			Quaternion.from(0, 0, 0, 1),
			point<3>(0, wallHeight / 2, ARENA_EXTENT),
			wallColor,
			1.6,
			0.85
		),
		...applyTransform(
			boxSegments(0.4, wallHeight, ARENA_EXTENT * 2),
			Quaternion.from(0, 0, 0, 1),
			point<3>(-ARENA_EXTENT, wallHeight / 2, 0),
			wallColor,
			1.6,
			0.85
		),
		...applyTransform(
			boxSegments(0.4, wallHeight, ARENA_EXTENT * 2),
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
				boxSegments(3, 2.8, 3),
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

	for (const pyramid of pyramids) {
		scene.push(
			...applyTransform(
				pyramidSegments(2.2, 2.8),
				lookAt(point<3>(0, 0, 0), pyramid.direction, defaultUp),
				pyramid.position,
				pyramid.stroke,
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
				boxSegments(2.6, 3, 2.6),
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

function clipSegmentToNearPlane(
	start: Point3D,
	end: Point3D
): readonly [Point3D, Point3D] | null {
	const z1 = z(start);
	const z2 = z(end);

	if (z1 < NEAR_PLANE && z2 < NEAR_PLANE) {
		return null;
	}

	if (z1 >= NEAR_PLANE && z2 >= NEAR_PLANE) {
		return [start, end] as const;
	}

	const interpolation = (NEAR_PLANE - z1) / (z2 - z1);
	const clipped = point<3>(
		x(start) + (x(end) - x(start)) * interpolation,
		y(start) + (y(end) - y(start)) * interpolation,
		NEAR_PLANE
	);

	return z1 < NEAR_PLANE
		? [clipped, end] as const
		: [start, clipped] as const;
}

function cameraSpacePoint(point3d: Point3D, pose: PlayerPose): Point3D {
	return Quaternion.rotateVector(
		viewOrientationFromPose(pose),
		sub<1, 3>(point3d, pose.position)
	);
}

export function projectPoint(cameraPoint: Point3D, width: number, height: number): Point2D {
	const focalPixels = Math.min(width, height) * 0.9;
	const depth = Math.max(z(cameraPoint), NEAR_PLANE);
	const scale = focalPixels / depth;
	return point<2>(
		(width / 2) + (x(cameraPoint) * scale),
		(height / 2) - (y(cameraPoint) * scale)
	);
}

export function projectWorldPoint(
	worldPoint: Point3D,
	pose: PlayerPose,
	width: number,
	height: number
): Point2D | null {
	const cameraPoint = cameraSpacePoint(worldPoint, pose);
	if (z(cameraPoint) < NEAR_PLANE) {
		return null;
	}

	return projectPoint(cameraPoint, width, height);
}

export function renderScene(
	scene: readonly WorldSegment[],
	pose: PlayerPose,
	width: number,
	height: number
): RenderedSegment[] {
	const rendered: RenderedSegment[] = [];

	for (const segment of scene) {
		const start = cameraSpacePoint(segment.start, pose);
		const end = cameraSpacePoint(segment.end, pose);
		const clipped = clipSegmentToNearPlane(start, end);

		if (clipped == null) {
			continue;
		}

		const [visibleStart, visibleEnd] = clipped;
		const depth = (z(visibleStart) + z(visibleEnd)) / 2;

		if (depth > FAR_PLANE) {
			continue;
		}

		const projectedStart = projectPoint(visibleStart, width, height);
		const projectedEnd = projectPoint(visibleEnd, width, height);
		const fade = 1 - Math.min(depth / FAR_PLANE, 0.82);

		rendered.push({
			x1: x(projectedStart),
			y1: y(projectedStart),
			x2: x(projectedEnd),
			y2: y(projectedEnd),
			stroke: segment.stroke,
			width: segment.width,
			opacity: Math.max(0.14, segment.opacity * fade),
			depth,
		});
	}

	return rendered.sort((left, right) => right.depth - left.depth);
}
