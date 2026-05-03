import {
	forwardFromPose as cameraForwardFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { point, Point2D, Point3D, scale, translate, x, z } from '#root/ts/math/cartesian.js';
import { defaultUp } from '#root/ts/math/lookAt.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import {
	box,
	octahedron,
	pyramid,
	rigidTransform,
	type Segment3D,
	triangularPrism,
} from '#root/ts/math/wireframe.js';
import {
	perspective,
	projectCameraPoint,
	projectWorldPoint as projectProjectedWorldPoint,
	type RenderedSegment2D,
	renderSegments,
	type StyledSegment3D,
	styleSegment,
} from '#root/ts/math/wireframe_render.js';

import { Bio, type Event } from '#root/project/zemn.me/bio/index.js';

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

export interface BioWalkMarker {
	readonly event: Event;
	readonly pedestalPosition: Point3D;
	readonly markerPosition: Point3D;
	readonly angle: number;
}

export const BIO_ARENA_EXTENT = 44;
export const EYE_HEIGHT = 1.8;
export const JUMP_VELOCITY = 6.5;
export const GRAVITY = 18;
export const DEFAULT_POSE: PlayerPose = {
	position: point<3>(0, EYE_HEIGHT, -28),
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
	if (length === 0) return point<3>(0, 0, 0);
	return point<3>(dx / length, 0, dz / length);
}

export function forwardFromPose(pose: Pick<PlayerPose, 'yaw' | 'pitch'>): Point3D {
	return cameraForwardFromPose(pose);
}

export function stepPlayer(
	pose: PlayerPose,
	input: MovementInput,
	deltaSeconds: number
): PlayerPose {
	const yawRotation = Quaternion.fromAxisAngle(defaultUp, pose.yaw);
	const forward = horizontalUnit(Quaternion.rotateVector(yawRotation, DEFAULT_FORWARD));
	const right = horizontalUnit(Quaternion.rotateVector(yawRotation, DEFAULT_RIGHT));
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
			Math.max(-BIO_ARENA_EXTENT + 1, Math.min(BIO_ARENA_EXTENT - 1, x(unclamped))),
			nextY,
			Math.max(-BIO_ARENA_EXTENT + 1, Math.min(BIO_ARENA_EXTENT - 1, z(unclamped)))
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
	return rigidTransform(segments, rotation, translation).map(([start, end]) =>
		styleSegment([start, end], { stroke, width, opacity })
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

function eventShape(event: Event): readonly Segment3D[] {
	const tags = event.tags?.map(tag => tag.text.toLowerCase()) ?? [];
	if (tags.some(tag => tag.includes('talk') || tag.includes('writing'))) {
		return triangularPrism(2.4, 2.2, 2.4);
	}
	if (tags.some(tag => tag.includes('security') || tag.includes('disclosure'))) {
		return octahedron(2.6);
	}
	if (tags.some(tag => tag.includes('software') || tag.includes('library'))) {
		return pyramid(2.4, 2.8);
	}
	return box(2.2, 2.2, 2.2);
}

function eventColor(event: Event): string {
	const tagString = (event.tags ?? []).map(tag => tag.text.toLowerCase()).join(':');
	if (tagString.includes('security')) return '#ff8f7a';
	if (tagString.includes('writing')) return '#93d4ff';
	if (tagString.includes('talk')) return '#d3ff8f';
	if (tagString.includes('software')) return '#f3c991';
	return '#e2d9ff';
}

function eventAltitude(event: Event): number {
	const hasLink = event.url != null;
	const score = (event.priority ?? 0) + (hasLink ? 1 : 0);
	return 3.8 + Math.min(score, 6) * 0.45;
}

function eventYear(event: Event): number {
	return event.date.getUTCFullYear();
}

export function createBioWalkMarkers(events: readonly Event[] = Bio.timeline): BioWalkMarker[] {
	const ordered = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
	const radiusBase = 8;
	const radiusStep = 0.95;
	const turnStep = Math.PI / 4;

	return ordered.map((event, index) => {
		const angle = index * turnStep;
		const radius = radiusBase + index * radiusStep;
		const pedestalPosition = point<3>(
			Math.cos(angle) * radius,
			1.25,
			Math.sin(angle) * radius,
		);

		return {
			event,
			angle,
			pedestalPosition,
			markerPosition: point<3>(
				pedestalPosition[0]![0]!,
				eventAltitude(event),
				pedestalPosition[2]![0]!,
			),
		};
	});
}

export function createBioWalkScene(events: readonly Event[] = Bio.timeline): WorldSegment[] {
	const scene: WorldSegment[] = [];
	for (let row = -BIO_ARENA_EXTENT; row <= BIO_ARENA_EXTENT; row += 2) {
		const major = row % 10 === 0;
		scene.push(
			worldSegment(
				point<3>(-BIO_ARENA_EXTENT, 0, row),
				point<3>(BIO_ARENA_EXTENT, 0, row),
				major ? '#4d6280' : '#334255',
				major ? 1.2 : 0.65,
				major ? 0.65 : 0.35
			),
			worldSegment(
				point<3>(row, 0, -BIO_ARENA_EXTENT),
				point<3>(row, 0, BIO_ARENA_EXTENT),
				major ? '#4d6280' : '#334255',
				major ? 1.2 : 0.65,
				major ? 0.65 : 0.35
			),
		);
	}

	const markers = createBioWalkMarkers(events);

	for (const [index, marker] of markers.entries()) {
		const { angle, event } = marker;
		const position = marker.pedestalPosition;
		const color = eventColor(event);
		const yearBand = (eventYear(event) % 5) * 0.18;
		scene.push(
			...applyTransform(
				box(2.8, 2.5 + yearBand, 2.8),
				Quaternion.from(0, 0, 0, 1),
				position,
				'#78644c',
				1.1,
				0.68,
			),
			...applyTransform(
				eventShape(event),
				Quaternion.fromAxisAngle(defaultUp, angle),
				marker.markerPosition,
				color,
				1.45,
				0.9,
			),
		);

		if (index > 0) {
			const prev = markers[index - 1]!.markerPosition;
			const curr = marker.markerPosition;
			scene.push(worldSegment(prev, curr, '#9ec3ff', 1, 0.55));
		}
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
): Point2D | null {
	return projectProjectedWorldPoint(worldPoint, pose, perspective(width, height));
}

export function renderScene(
	scene: readonly WorldSegment[],
	pose: PlayerPose,
	width: number,
	height: number
): RenderedSegment[] {
	return renderSegments(scene, pose, perspective(width, height));
}
