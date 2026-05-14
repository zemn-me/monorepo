import {
	forwardFromPose as cameraForwardFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import {
	magnitude,
	Point2D,
	Point3D,
	point,
	scale,
	translate,
	x,
	y,
	z,
} from '#root/ts/math/cartesian.js';
import { defaultUp } from '#root/ts/math/lookAt.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { rigidTransform, type Segment3D } from '#root/ts/math/wireframe.js';
import {
	perspective,
	projectCameraPoint,
	projectWorldPoint as projectProjectedWorldPoint,
	type RenderedSegment2D,
	renderSegments,
	type StyledSegment3D,
	styleSegment,
} from '#root/ts/math/wireframe_render.js';
import { type Result, unwrap } from '#root/ts/result/result.js';

export type SolidKind =
	| 'tetrahedron'
	| 'cube'
	| 'octahedron'
	| 'dodecahedron'
	| 'icosahedron';

export interface PlatonicShape {
	readonly kind: SolidKind;
	readonly segments: readonly Segment3D[];
	readonly edgeCount: number;
}

export interface PlayerPose extends YawPitchPose {
	readonly verticalVelocity: number;
}

export interface MovementInput {
	readonly forward: number;
	readonly strafe: number;
	readonly sprint: boolean;
	readonly jump: boolean;
}

export interface SolidInstance {
	readonly kind: SolidKind;
	readonly position: Point3D;
	readonly segments: readonly Segment3D[];
	readonly spinAxis: Point3D;
	readonly spinPhase: number;
	readonly spinRate: number;
	readonly stroke: string;
	readonly width: number;
	readonly opacity: number;
}

export interface PlatonicField {
	readonly solids: readonly SolidInstance[];
	readonly staticSegments: readonly WorldSegment[];
	readonly solidCount: number;
	readonly segmentCount: number;
}

export type WorldSegment = StyledSegment3D;
export type RenderedSegment = RenderedSegment2D;

export const FIELD_COLUMNS = 13;
export const FIELD_ROWS = 13;
export const FIELD_LAYERS = 2;
export const WORLD_EXTENT = 52;
export const EYE_HEIGHT = 1.8;
export const JUMP_VELOCITY = 7.5;
export const GRAVITY = 20;
export const WALK_SPEED = 9;
export const SPRINT_SPEED = 18;
export const FAR_PLANE = 135;
export const DEFAULT_POSE: PlayerPose = {
	position: point<3>(0, EYE_HEIGHT, -48),
	yaw: 0,
	pitch: 0,
	verticalVelocity: 0,
};

const PHI = (1 + Math.sqrt(5)) / 2;
const INVERSE_PHI = 1 / PHI;
const DEFAULT_FORWARD = point<3>(0, 0, 1);
const DEFAULT_RIGHT = point<3>(1, 0, 0);
const FIELD_SPACING = 6.4;
const FIELD_Z_OFFSET = 5;
const SHAPE_COLORS: Record<SolidKind, string> = {
	tetrahedron: '#ff6b5f',
	cube: '#f2c14e',
	octahedron: '#55d6be',
	dodecahedron: '#9edb59',
	icosahedron: '#c589ff',
};

function distance3(a: Point3D, b: Point3D): number {
	return Math.hypot(x(a) - x(b), y(a) - y(b), z(a) - z(b));
}

function normalizeVertices(vertices: readonly Point3D[]): readonly Point3D[] {
	const radius = Math.max(...vertices.map(vertex => magnitude(vertex)));
	return vertices.map(vertex => scale(vertex, 1 / radius) as Point3D);
}

function segmentsFromVertices(vertices: readonly Point3D[]): Segment3D[] {
	let nearest = Number.POSITIVE_INFINITY;

	for (let start = 0; start < vertices.length; start++) {
		for (let end = start + 1; end < vertices.length; end++) {
			const distance = distance3(vertices[start]!, vertices[end]!);
			if (distance > 0 && distance < nearest) {
				nearest = distance;
			}
		}
	}

	const tolerance = Math.max(nearest * 1e-6, 1e-6);
	const segments: Segment3D[] = [];
	for (let start = 0; start < vertices.length; start++) {
		for (let end = start + 1; end < vertices.length; end++) {
			if (distance3(vertices[start]!, vertices[end]!) <= nearest + tolerance) {
				segments.push([vertices[start]!, vertices[end]!] as const);
			}
		}
	}

	return segments;
}

function shape(kind: SolidKind, vertices: readonly Point3D[]): PlatonicShape {
	const segments = segmentsFromVertices(normalizeVertices(vertices));
	return {
		kind,
		segments,
		edgeCount: segments.length,
	};
}

export const PLATONIC_SHAPES: readonly PlatonicShape[] = [
	shape('tetrahedron', [
		point<3>(1, 1, 1),
		point<3>(-1, -1, 1),
		point<3>(-1, 1, -1),
		point<3>(1, -1, -1),
	]),
	shape('cube', [
		point<3>(-1, -1, -1),
		point<3>(-1, -1, 1),
		point<3>(-1, 1, -1),
		point<3>(-1, 1, 1),
		point<3>(1, -1, -1),
		point<3>(1, -1, 1),
		point<3>(1, 1, -1),
		point<3>(1, 1, 1),
	]),
	shape('octahedron', [
		point<3>(1, 0, 0),
		point<3>(-1, 0, 0),
		point<3>(0, 1, 0),
		point<3>(0, -1, 0),
		point<3>(0, 0, 1),
		point<3>(0, 0, -1),
	]),
	shape('dodecahedron', [
		point<3>(-1, -1, -1),
		point<3>(-1, -1, 1),
		point<3>(-1, 1, -1),
		point<3>(-1, 1, 1),
		point<3>(1, -1, -1),
		point<3>(1, -1, 1),
		point<3>(1, 1, -1),
		point<3>(1, 1, 1),
		point<3>(0, -INVERSE_PHI, -PHI),
		point<3>(0, -INVERSE_PHI, PHI),
		point<3>(0, INVERSE_PHI, -PHI),
		point<3>(0, INVERSE_PHI, PHI),
		point<3>(-INVERSE_PHI, -PHI, 0),
		point<3>(-INVERSE_PHI, PHI, 0),
		point<3>(INVERSE_PHI, -PHI, 0),
		point<3>(INVERSE_PHI, PHI, 0),
		point<3>(-PHI, 0, -INVERSE_PHI),
		point<3>(PHI, 0, -INVERSE_PHI),
		point<3>(-PHI, 0, INVERSE_PHI),
		point<3>(PHI, 0, INVERSE_PHI),
	]),
	shape('icosahedron', [
		point<3>(0, -1, -PHI),
		point<3>(0, -1, PHI),
		point<3>(0, 1, -PHI),
		point<3>(0, 1, PHI),
		point<3>(-1, -PHI, 0),
		point<3>(-1, PHI, 0),
		point<3>(1, -PHI, 0),
		point<3>(1, PHI, 0),
		point<3>(-PHI, 0, -1),
		point<3>(PHI, 0, -1),
		point<3>(-PHI, 0, 1),
		point<3>(PHI, 0, 1),
	]),
];

const SHAPES_BY_KIND: Record<SolidKind, PlatonicShape> = {
	tetrahedron: PLATONIC_SHAPES[0]!,
	cube: PLATONIC_SHAPES[1]!,
	octahedron: PLATONIC_SHAPES[2]!,
	dodecahedron: PLATONIC_SHAPES[3]!,
	icosahedron: PLATONIC_SHAPES[4]!,
};

const SOLID_KINDS: readonly SolidKind[] = [
	'tetrahedron',
	'cube',
	'octahedron',
	'dodecahedron',
	'icosahedron',
];

function horizontalUnit(point3d: Point3D): Point3D {
	const dx = x(point3d);
	const dz = z(point3d);
	const length = Math.hypot(dx, dz);

	if (length === 0) {
		return point<3>(0, 0, 0);
	}

	return point<3>(dx / length, 0, dz / length);
}

function scaleSegments(
	segments: readonly Segment3D[],
	scalar: number
): Segment3D[] {
	return segments.map(
		([start, end]) =>
			[
				scale(start, scalar) as Point3D,
				scale(end, scalar) as Point3D,
			] as const
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

function createGridSegments(): WorldSegment[] {
	const scene: WorldSegment[] = [];

	for (let line = -WORLD_EXTENT; line <= WORLD_EXTENT; line += 4) {
		const major = line % 16 === 0;
		const stroke = major ? '#d6a742' : '#355264';
		const width = major ? 1.15 : 0.65;
		const opacity = major ? 0.62 : 0.35;

		scene.push(
			worldSegment(
				point<3>(-WORLD_EXTENT, 0, line),
				point<3>(WORLD_EXTENT, 0, line),
				stroke,
				width,
				opacity
			),
			worldSegment(
				point<3>(line, 0, -WORLD_EXTENT),
				point<3>(line, 0, WORLD_EXTENT),
				stroke,
				width,
				opacity
			)
		);
	}

	for (const corner of [
		point<3>(-WORLD_EXTENT, 3, -WORLD_EXTENT),
		point<3>(WORLD_EXTENT, 3, -WORLD_EXTENT),
		point<3>(WORLD_EXTENT, 3, WORLD_EXTENT),
		point<3>(-WORLD_EXTENT, 3, WORLD_EXTENT),
	]) {
		scene.push(
			worldSegment(
				point<3>(x(corner), 0, z(corner)),
				corner,
				'#ff6b5f',
				1.4,
				0.72
			)
		);
	}

	return scene;
}

function createSolidInstances(): SolidInstance[] {
	const solids: SolidInstance[] = [];

	for (let layer = 0; layer < FIELD_LAYERS; layer++) {
		for (let row = 0; row < FIELD_ROWS; row++) {
			for (let column = 0; column < FIELD_COLUMNS; column++) {
				const index =
					layer * FIELD_ROWS * FIELD_COLUMNS +
					row * FIELD_COLUMNS +
					column;
				const kind = SOLID_KINDS[index % SOLID_KINDS.length]!;
				const shapeForKind = SHAPES_BY_KIND[kind];
				const radius = 1.08 + ((column * 3 + row * 5 + layer) % 6) * 0.16;
				const xOffset = (row % 2 === 0 ? -0.5 : 0.5) * 1.25;
				const yOffset = ((column + row) % 3) * 0.34;
				const position = point<3>(
					(column - (FIELD_COLUMNS - 1) / 2) * FIELD_SPACING + xOffset,
					EYE_HEIGHT + 2.15 + layer * 4.65 + yOffset,
					(row - (FIELD_ROWS - 1) / 2) * FIELD_SPACING +
						FIELD_Z_OFFSET +
						layer * 1.55
				);

				solids.push({
					kind,
					position,
					segments: scaleSegments(shapeForKind.segments, radius),
					spinAxis: point<3>(
						((column % 3) - 1) * 0.5,
						0.8 + layer * 0.25,
						((row % 3) - 1) * 0.45
					),
					spinPhase: index * 0.773,
					spinRate: 0.32 + (index % 7) * 0.045,
					stroke: SHAPE_COLORS[kind],
					width: shapeForKind.edgeCount >= 30 ? 0.95 : 1.18,
					opacity: shapeForKind.edgeCount >= 30 ? 0.78 : 0.88,
				});
			}
		}
	}

	return solids;
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
	const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
	const movement = scale(moveDirection, speed * deltaSeconds) as Point3D;
	const onGround = y(pose.position) <= EYE_HEIGHT + 1e-6;
	const jumpVelocity =
		input.jump && onGround ? JUMP_VELOCITY : pose.verticalVelocity;
	const nextVerticalVelocity = jumpVelocity - GRAVITY * deltaSeconds;
	const verticalMovement = jumpVelocity * deltaSeconds;
	const unclamped = translate(
		pose.position,
		translate(movement, point<3>(0, verticalMovement, 0)) as Point3D
	) as Point3D;
	const nextY = Math.max(EYE_HEIGHT, y(unclamped));
	const landed = nextY === EYE_HEIGHT && nextVerticalVelocity < 0;

	return {
		...pose,
		position: point<3>(
			Math.max(-WORLD_EXTENT + 1, Math.min(WORLD_EXTENT - 1, x(unclamped))),
			nextY,
			Math.max(-WORLD_EXTENT + 1, Math.min(WORLD_EXTENT - 1, z(unclamped)))
		),
		verticalVelocity: landed ? 0 : nextVerticalVelocity,
	};
}

export function createPlatonicField(): PlatonicField {
	const solids = createSolidInstances();
	const staticSegments = createGridSegments();
	const segmentCount =
		staticSegments.length +
		solids.reduce((total, solid) => total + solid.segments.length, 0);

	return {
		solids,
		staticSegments,
		solidCount: solids.length,
		segmentCount,
	};
}

export function createFrameSegments(
	field: PlatonicField,
	timeSeconds: number,
	solidLimit = field.solidCount
): WorldSegment[] {
	const scene: WorldSegment[] = [...field.staticSegments];
	const renderedSolidCount = Math.max(
		0,
		Math.min(field.solids.length, Math.trunc(solidLimit))
	);

	for (let solidIndex = 0; solidIndex < renderedSolidCount; solidIndex++) {
		const solid = field.solids[solidIndex]!;
		const rotation = unwrap(
			Quaternion.fromAxisAngle(
				solid.spinAxis,
				solid.spinPhase + timeSeconds * solid.spinRate
			)
		);
		for (const segment of unwrap(
			rigidTransform(solid.segments, rotation, solid.position)
		)) {
			scene.push(
				styleSegment(segment, {
					stroke: solid.stroke,
					width: solid.width,
					opacity: solid.opacity,
				})
			);
		}
	}

	return scene;
}

export function segmentCountForSolidLimit(
	field: PlatonicField,
	solidLimit: number
): number {
	const renderedSolidCount = Math.max(
		0,
		Math.min(field.solids.length, Math.trunc(solidLimit))
	);
	let segmentCount = field.staticSegments.length;

	for (let solidIndex = 0; solidIndex < renderedSolidCount; solidIndex++) {
		segmentCount += field.solids[solidIndex]!.segments.length;
	}

	return segmentCount;
}

export function projectPoint(
	cameraPoint: Point3D,
	width: number,
	height: number
): Point2D {
	return projectCameraPoint(
		cameraPoint,
		perspective(width, height, { farPlane: FAR_PLANE, focalScale: 0.78 })
	);
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
		perspective(width, height, { farPlane: FAR_PLANE, focalScale: 0.78 })
	);
}

export function renderScene(
	field: PlatonicField,
	pose: PlayerPose,
	width: number,
	height: number,
	timeSeconds = 0,
	solidLimit = field.solidCount
): Result<RenderedSegment[], Error> {
	return renderSegments(
		createFrameSegments(field, timeSeconds, solidLimit),
		pose,
		perspective(width, height, { farPlane: FAR_PLANE, focalScale: 0.78 })
	);
}
