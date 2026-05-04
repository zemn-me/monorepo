import {
	cameraSpacePointFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import {
	type Point,
	type Point2D,
	type Point3D,
	point,
	translate,
	x,
	y,
	z,
} from '#root/ts/math/cartesian.js';
import { box, type Segment3D } from '#root/ts/math/wireframe.js';
import {
	perspective,
	projectWorldPoint,
	type RenderedSegment2D,
	renderSegments,
	type StyledSegment3D,
	styleSegment,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

export const AQUARIUM_WIDTH = 14;
export const AQUARIUM_HEIGHT = 9;
export const AQUARIUM_DEPTH = 7;
export const CAMERA_ORBIT_RADIANS_PER_SECOND = (Math.PI * 2) / 96;
export const WATER_LEVEL_RATIO = 0.94;
export const WATER_SURFACE_Y = AQUARIUM_HEIGHT * WATER_LEVEL_RATIO;
export const SWIM_FLOOR_Y = AQUARIUM_HEIGHT * 0.05;
export const SWIM_CEILING_Y = WATER_SURFACE_Y - AQUARIUM_HEIGHT * 0.1;

const CAMERA_DISTANCE = 18;
const CAMERA_HEIGHT = 7.2;
const TANK_TARGET = point<3>(0, AQUARIUM_HEIGHT * 0.52, 0);
const TANK_OFFSET = point<3>(0, AQUARIUM_HEIGHT / 2, 0);

export interface RenderedTankFace {
	readonly key: string;
	readonly points: string;
	readonly fill: string;
	readonly opacity: number;
	readonly depth: number;
}

export interface AquariumScene {
	readonly pose: YawPitchPose;
	readonly faces: readonly RenderedTankFace[];
	readonly segments: readonly RenderedSegment2D[];
}

export interface AquariumParticleProjection {
	readonly x: number;
	readonly y: number;
	readonly depth: number;
	readonly fontSize: number;
	readonly opacity: number;
}

interface TankFace {
	readonly key: string;
	readonly vertices: readonly Point3D[];
	readonly fill: string;
	readonly opacity: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function average(values: readonly number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stableUnitInterval(seed: string): number {
	let hash = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}

	return (hash >>> 0) / 0xffffffff;
}

function worldSegment(
	start: Point3D,
	end: Point3D,
	stroke: string,
	width: number,
	opacity: number
): StyledSegment3D {
	return styleSegment([start, end], { stroke, width, opacity });
}

function translateSegment(segment: Segment3D, offset: Point3D): Segment3D {
	return [
		translate(segment[0], offset) as Point3D,
		translate(segment[1], offset) as Point3D,
	] as const;
}

function loopSegments(
	points: readonly Point3D[],
	stroke: string,
	width: number,
	opacity: number
): StyledSegment3D[] {
	return points.map((start, index) =>
		worldSegment(
			start,
			points[(index + 1) % points.length]!,
			stroke,
			width,
			opacity
		)
	);
}

function tankPoint(
	xPosition: number,
	yPosition: number,
	zPosition: number
): Point3D {
	return point<3>(
		xPosition * (AQUARIUM_WIDTH / 2),
		yPosition * AQUARIUM_HEIGHT,
		zPosition * (AQUARIUM_DEPTH / 2)
	);
}

function aquariumPerspective(width: number, height: number) {
	return perspective(width, height, {
		farPlane: 58,
		focalScale: 0.78,
	});
}

export function orbitCameraPose(angle: number): YawPitchPose {
	const position = point<3>(
		Math.sin(angle) * CAMERA_DISTANCE,
		CAMERA_HEIGHT,
		Math.cos(angle) * CAMERA_DISTANCE
	);
	const dx = x(TANK_TARGET) - x(position);
	const dy = y(TANK_TARGET) - y(position);
	const dz = z(TANK_TARGET) - z(position);
	const horizontalDistance = Math.hypot(dx, dz);

	return {
		position,
		yaw: Math.atan2(dx, dz),
		pitch: Math.atan2(-dy, horizontalDistance),
	};
}

export function aquariumSegments(): StyledSegment3D[] {
	const segments: StyledSegment3D[] = [
		...box(AQUARIUM_WIDTH, AQUARIUM_HEIGHT, AQUARIUM_DEPTH).map(segment =>
			styleSegment(translateSegment(segment, TANK_OFFSET), {
				stroke: '#c7fbff',
				width: 1.55,
				opacity: 0.78,
			})
		),
	];

	const topInset = 0.08;
	const waterTop = [
		tankPoint(-1 + topInset, WATER_LEVEL_RATIO, -1 + topInset),
		tankPoint(1 - topInset, WATER_LEVEL_RATIO, -1 + topInset),
		tankPoint(1 - topInset, WATER_LEVEL_RATIO, 1 - topInset),
		tankPoint(-1 + topInset, WATER_LEVEL_RATIO, 1 - topInset),
	];

	segments.push(...loopSegments(waterTop, '#9feeff', 1, 0.42));

	for (let index = -3; index <= 3; index++) {
		const xPosition = (index / 3) * (AQUARIUM_WIDTH / 2) * 0.86;
		segments.push(
			worldSegment(
				point<3>(xPosition, 0.16, -AQUARIUM_DEPTH * 0.43),
				point<3>(xPosition, 0.16, AQUARIUM_DEPTH * 0.43),
				'#d9bd82',
				0.62,
				0.36
			)
		);
	}

	for (let index = -2; index <= 2; index++) {
		const zPosition = (index / 2) * (AQUARIUM_DEPTH / 2) * 0.78;
		segments.push(
			worldSegment(
				point<3>(-AQUARIUM_WIDTH * 0.43, 0.17, zPosition),
				point<3>(AQUARIUM_WIDTH * 0.43, 0.17, zPosition),
				'#f1c7a2',
				0.58,
				0.28
			)
		);
	}

	for (const xPosition of [-AQUARIUM_WIDTH / 2, AQUARIUM_WIDTH / 2]) {
		for (const zPosition of [-AQUARIUM_DEPTH / 2, AQUARIUM_DEPTH / 2]) {
			segments.push(
				worldSegment(
					point<3>(xPosition, 0, zPosition),
					point<3>(xPosition, AQUARIUM_HEIGHT, zPosition),
					'#f4ffff',
					2.2,
					0.56
				)
			);
		}
	}

	return segments;
}

function tankFaces(): readonly TankFace[] {
	const leftBottomFront = tankPoint(-1, 0, 1);
	const rightBottomFront = tankPoint(1, 0, 1);
	const leftTopFront = tankPoint(-1, 1, 1);
	const rightTopFront = tankPoint(1, 1, 1);
	const leftBottomBack = tankPoint(-1, 0, -1);
	const rightBottomBack = tankPoint(1, 0, -1);
	const leftTopBack = tankPoint(-1, 1, -1);
	const rightTopBack = tankPoint(1, 1, -1);
	const leftWaterFront = point<3>(
		-AQUARIUM_WIDTH / 2,
		WATER_SURFACE_Y,
		AQUARIUM_DEPTH / 2
	);
	const rightWaterFront = point<3>(
		AQUARIUM_WIDTH / 2,
		WATER_SURFACE_Y,
		AQUARIUM_DEPTH / 2
	);
	const leftWaterBack = point<3>(
		-AQUARIUM_WIDTH / 2,
		WATER_SURFACE_Y,
		-AQUARIUM_DEPTH / 2
	);
	const rightWaterBack = point<3>(
		AQUARIUM_WIDTH / 2,
		WATER_SURFACE_Y,
		-AQUARIUM_DEPTH / 2
	);

	return [
		{
			key: 'back',
			vertices: [
				leftBottomBack,
				rightBottomBack,
				rightTopBack,
				leftTopBack,
			],
			fill: '#71dcff',
			opacity: 0.1,
		},
		{
			key: 'left',
			vertices: [
				leftBottomBack,
				leftBottomFront,
				leftTopFront,
				leftTopBack,
			],
			fill: '#a7f4ff',
			opacity: 0.065,
		},
		{
			key: 'right',
			vertices: [
				rightBottomFront,
				rightBottomBack,
				rightTopBack,
				rightTopFront,
			],
			fill: '#9deaff',
			opacity: 0.06,
		},
		{
			key: 'bottom',
			vertices: [
				leftBottomFront,
				rightBottomFront,
				rightBottomBack,
				leftBottomBack,
			],
			fill: '#caa56d',
			opacity: 0.2,
		},
		{
			key: 'surface',
			vertices: [
				leftWaterFront,
				rightWaterFront,
				rightWaterBack,
				leftWaterBack,
			],
			fill: '#d8ffff',
			opacity: 0.12,
		},
		{
			key: 'front',
			vertices: [
				rightBottomFront,
				leftBottomFront,
				leftTopFront,
				rightTopFront,
			],
			fill: '#e7ffff',
			opacity: 0.045,
		},
	];
}

function projectFaces(
	pose: YawPitchPose,
	width: number,
	height: number
): RenderedTankFace[] {
	const projection = aquariumPerspective(width, height);
	return tankFaces()
		.map(face => {
			const projected = face.vertices.map(vertex =>
				unwrap(projectWorldPoint(vertex, pose, projection))
			);

			if (projected.some(vertex => vertex == null)) {
				return null;
			}

			const cameraDepths = face.vertices.map(vertex =>
				z(unwrap(cameraSpacePointFromPose(vertex, pose)))
			);

			return {
				key: face.key,
				points: (projected as Point2D[])
					.map(vertex => `${x(vertex)},${y(vertex)}`)
					.join(' '),
				fill: face.fill,
				opacity: face.opacity,
				depth: average(cameraDepths),
			};
		})
		.filter((face): face is RenderedTankFace => face != null)
		.sort((left, right) => right.depth - left.depth);
}

export function renderAquariumScene(
	angle: number,
	width: number,
	height: number
): AquariumScene {
	const pose = orbitCameraPose(angle);
	const projection = aquariumPerspective(width, height);

	return {
		pose,
		faces: projectFaces(pose, width, height),
		segments: unwrap(renderSegments(aquariumSegments(), pose, projection)),
	};
}

export function particleWorldPoint(
	id: string,
	position: Point<2>,
	size: Point<2>
): Point3D {
	const normalizedX = clamp(x(position) / x(size), 0, 1);
	const normalizedY = clamp(y(position) / y(size), 0, 1);
	const normalizedZ = stableUnitInterval(id);

	return point<3>(
		(normalizedX - 0.5) * AQUARIUM_WIDTH * 0.9,
		normalizedY * (SWIM_CEILING_Y - SWIM_FLOOR_Y) + SWIM_FLOOR_Y,
		(normalizedZ - 0.5) * AQUARIUM_DEPTH * 0.78
	);
}

export function projectAquariumParticle(
	id: string,
	position: Point<2>,
	radius: number,
	size: Point<2>,
	pose: YawPitchPose,
	width: number,
	height: number
): AquariumParticleProjection | null {
	const projection = aquariumPerspective(width, height);
	const worldPoint = particleWorldPoint(id, position, size);
	const projected = unwrap(projectWorldPoint(worldPoint, pose, projection));

	if (projected == null) {
		return null;
	}

	const cameraPoint = unwrap(cameraSpacePointFromPose(worldPoint, pose));
	const depth = z(cameraPoint);
	const depthScale = clamp(16 / Math.max(depth, 1), 0.64, 1.48);

	return {
		x: x(projected),
		y: y(projected),
		depth,
		fontSize: Math.max(9, radius * 1.62 * depthScale),
		opacity: clamp(1.15 - depth / 42, 0.5, 1),
	};
}

export function previewProjectedFaceCount(angle: number): number {
	const pose = orbitCameraPose(angle);
	return projectFaces(pose, 1, 1).length;
}
