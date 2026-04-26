import {
	EYE_HEIGHT,
	type PlayerPose,
	type WorldSegment,
} from '#root/project/zemn.me/app/experiments/arena/scene.js';
import { point, Point3D, translate, x, z } from '#root/ts/math/cartesian.js';
import { defaultUp, lookAt } from '#root/ts/math/lookAt.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { box, rigidTransform, type Segment3D } from '#root/ts/math/wireframe.js';
import { styleSegment } from '#root/ts/math/wireframe_render.js';

export interface Penguin {
	readonly name: string;
	readonly species: string;
	readonly blurb: string;
	readonly position: Point3D;
}

export interface PenguinEncounter extends Penguin {
	readonly distance: number;
}

export interface PenguinBody {
	readonly centre: Point3D;
	readonly outline: readonly Point3D[];
}

export interface PenguinWorld {
	readonly scene: WorldSegment[];
	readonly penguins: Penguin[];
	readonly penguinBodies: PenguinBody[];
	readonly startPose: PlayerPose;
}

const ICE_STROKE = '#c8f3ff';
const ICE_DEEP_STROKE = '#8ed5f2';
const PENGUIN_STROKE = '#15242b';
const BEAK_STROKE = '#ffb347';
const WATER_STROKE = '#4cb3ff';

function worldSegment(
	start: Point3D,
	end: Point3D,
	stroke: string,
	width: number,
	opacity: number
): WorldSegment {
	return styleSegment([start, end], { stroke, width, opacity }) as WorldSegment;
}

function applyTransform(
	segments: readonly Segment3D[],
	rotation: Quaternion.Quaternion,
	translation: Point3D,
	stroke: string,
	width: number,
	opacity: number
): WorldSegment[] {
	return rigidTransform(segments, rotation, translation).map(
		([start, end]) => worldSegment(start, end, stroke, width, opacity)
	);
}

function loopSegments(points: readonly Point3D[]): readonly Segment3D[] {
	return points.map((start, index) => [
		start,
		points[(index + 1) % points.length]!,
	] as const);
}

function verticalRibs(
	top: readonly Point3D[],
	bottomY: number
): readonly Segment3D[] {
	return top.map(vertex => [
		vertex,
		point<3>(x(vertex), bottomY, z(vertex)),
	] as const);
}

function withY(points: readonly [number, number][], yValue: number): Point3D[] {
	return points.map(([px, pz]) => point<3>(px, yValue, pz));
}

function icebergSegments(): WorldSegment[] {
	const outline = withY(
		[
			[-13, -10],
			[-7, -15],
			[4, -14],
			[14, -8],
			[16, 1],
			[11, 11],
			[2, 15],
			[-8, 13],
			[-14, 6],
			[-15, -2],
		],
		0
	);
	const keel = withY(
		[
			[-10, -7],
			[-4, -11],
			[4, -10],
			[10, -5],
			[11, 1],
			[7, 8],
			[1, 10],
			[-6, 8],
			[-11, 4],
			[-12, -2],
		],
		-6
	);
	const crackA = [
		point<3>(-6, 0.03, -4),
		point<3>(-2, 0.03, -1),
		point<3>(2, 0.03, 2),
		point<3>(5, 0.03, 6),
	];
	const crackB = [
		point<3>(3, 0.03, -8),
		point<3>(1, 0.03, -4),
		point<3>(-2, 0.03, -2),
		point<3>(-5, 0.03, 1),
	];

	const segments: WorldSegment[] = [];
	for (const [start, end] of loopSegments(outline)) {
		segments.push(worldSegment(start, end, ICE_STROKE, 2.3, 0.92));
	}
	for (const [start, end] of loopSegments(keel)) {
		segments.push(worldSegment(start, end, ICE_DEEP_STROKE, 1.7, 0.56));
	}
	for (const [start, end] of verticalRibs(outline, -6)) {
		segments.push(worldSegment(start, end, ICE_DEEP_STROKE, 1.25, 0.62));
	}
	for (const [start, end] of loopSegments(crackA)) {
		segments.push(worldSegment(start, end, '#e8fbff', 1.1, 0.75));
	}
	for (const [start, end] of loopSegments(crackB)) {
		segments.push(worldSegment(start, end, '#d0f1ff', 1, 0.7));
	}

	for (const radius of [24, 34]) {
		segments.push(
			worldSegment(
				point<3>(-radius, -1.4, -radius),
				point<3>(radius, -1.4, -radius),
				WATER_STROKE,
				1,
				0.28
			),
			worldSegment(
				point<3>(radius, -1.4, -radius),
				point<3>(radius, -1.4, radius),
				WATER_STROKE,
				1,
				0.28
			),
			worldSegment(
				point<3>(radius, -1.4, radius),
				point<3>(-radius, -1.4, radius),
				WATER_STROKE,
				1,
				0.28
			),
			worldSegment(
				point<3>(-radius, -1.4, radius),
				point<3>(-radius, -1.4, -radius),
				WATER_STROKE,
				1,
				0.28
			)
		);
	}

	return segments;
}

function penguinShape(): {
	readonly body: readonly Segment3D[];
	readonly fill: readonly Point3D[];
	readonly beak: readonly Segment3D[];
} {
	const body = [
		[point<3>(0, 0, 0), point<3>(-0.55, 0.9, 0)],
		[point<3>(-0.55, 0.9, 0), point<3>(0, 2.05, 0)],
		[point<3>(0, 2.05, 0), point<3>(0.55, 0.9, 0)],
		[point<3>(0.55, 0.9, 0), point<3>(0, 0, 0)],
		[point<3>(-0.2, 1.45, 0), point<3>(0.2, 1.45, 0)],
		[point<3>(-0.62, 1.05, 0), point<3>(-0.98, 0.45, 0.14)],
		[point<3>(0.62, 1.05, 0), point<3>(0.98, 0.45, 0.14)],
		[point<3>(-0.2, 0.08, 0.2), point<3>(-0.5, 0, 0.42)],
		[point<3>(0.2, 0.08, 0.2), point<3>(0.5, 0, 0.42)],
		[point<3>(0, 2.05, 0), point<3>(0, 2.45, 0.06)],
	] as const;
	const fill = [
		point<3>(0, 2.05, 0.01),
		point<3>(0.52, 0.95, 0.02),
		point<3>(0.22, 0.1, 0.22),
		point<3>(-0.22, 0.1, 0.22),
		point<3>(-0.52, 0.95, 0.02),
	] as const;

	const beak = [
		[point<3>(0, 1.7, 0.06), point<3>(0.26, 1.58, 0.56)],
		[point<3>(0.26, 1.58, 0.56), point<3>(0, 1.46, 0.08)],
		[point<3>(0, 1.46, 0.08), point<3>(0, 1.7, 0.06)],
	] as const;

	return { body, fill, beak };
}

function penguinSegments(position: Point3D, facing: Point3D): WorldSegment[] {
	const shape = penguinShape();
	const rotation = lookAt(point<3>(0, 0, 0), facing, defaultUp);
	return [
		...applyTransform(shape.body, rotation, position, PENGUIN_STROKE, 1.8, 0.96),
		...applyTransform(shape.beak, rotation, position, BEAK_STROKE, 1.4, 0.92),
	];
}

function penguinBody(position: Point3D, facing: Point3D): PenguinBody {
	const shape = penguinShape();
	const rotation = lookAt(point<3>(0, 0, 0), facing, defaultUp);
	return {
		centre: translate(position, point<3>(0, 1.1, 0)) as Point3D,
		outline: shape.fill.map(vertex =>
			translate(Quaternion.rotateVector(rotation, vertex), position) as Point3D
		),
	};
}

export function createPenguinWorld(): PenguinWorld {
	const penguins: Penguin[] = [
		{
			name: 'Mabel',
			species: 'Adelie',
			blurb: 'Collects smooth pebbles and does not respect personal space.',
			position: point<3>(-8.5, 0, -3.5),
		},
		{
			name: 'Dottie',
			species: 'Gentoo',
			blurb: 'Stares at the crack in the iceberg like it owes her money.',
			position: point<3>(5.2, 0, -6.5),
		},
		{
			name: 'Wobble',
			species: 'King',
			blurb: 'Very tall. Absolutely certain this is his iceberg now.',
			position: point<3>(8.5, 0, 5.8),
		},
		{
			name: 'Pip',
			species: 'Little',
			blurb: 'Has discovered sliding and will not stop.',
			position: point<3>(-4, 0, 8.2),
		},
		{
			name: 'Aunt Sleet',
			species: 'Chinstrap',
			blurb: 'Judges your footwork, but quietly appreciates the visit.',
			position: point<3>(0.8, 0, 2.5),
		},
	];

	const penguinBodies = penguins.map((penguin, index) =>
		penguinBody(
			penguin.position,
			point<3>(
				Math.cos((index / penguins.length) * Math.PI * 2),
				0,
				Math.sin((index / penguins.length) * Math.PI * 2)
			)
		)
	);

	const scene = [
		...icebergSegments(),
		...applyTransform(
			box(5.5, 1.2, 4.5),
			Quaternion.fromAxisAngle(defaultUp, Math.PI / 8),
			point<3>(-9.8, -0.45, 10.8),
			ICE_DEEP_STROKE,
			1.4,
			0.5
		),
		...applyTransform(
			box(4.6, 0.9, 3.2),
			Quaternion.fromAxisAngle(defaultUp, -Math.PI / 6),
			point<3>(12.4, -0.6, -12.6),
			ICE_DEEP_STROKE,
			1.25,
			0.42
		),
		...penguins.flatMap((penguin, index) =>
			penguinSegments(
				penguin.position,
				point<3>(
					Math.cos((index / penguins.length) * Math.PI * 2),
					0,
					Math.sin((index / penguins.length) * Math.PI * 2)
				)
			)
		),
	];

	return {
		scene,
		penguins,
		penguinBodies,
		startPose: {
			position: point<3>(0, EYE_HEIGHT, -11.5),
			yaw: 0,
			pitch: -0.08,
			verticalVelocity: 0,
		},
	};
}

export function nearestPenguin(
	penguins: readonly Penguin[],
	position: Point3D
): PenguinEncounter | null {
	let nearest: PenguinEncounter | null = null;

	for (const penguin of penguins) {
		const distance = Math.hypot(
			x(penguin.position) - x(position),
			z(penguin.position) - z(position)
		);

		if (nearest == null || distance < nearest.distance) {
			nearest = {
				...penguin,
				distance,
			};
		}
	}

	return nearest;
}
