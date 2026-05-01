import {
	EYE_HEIGHT,
	type PlayerPose,
	projectWorldPoint,
	type WorldSegment,
} from '#root/project/zemn.me/app/experiments/arena/scene.js';
import { point, Point2D, Point3D, translate, x, y, z } from '#root/ts/math/cartesian.js';
import { defaultUp, lookAt } from '#root/ts/math/lookAt.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { box, rigidTransform, type Segment3D } from '#root/ts/math/wireframe.js';
import { styleSegment } from '#root/ts/math/wireframe_render.js';

export interface Penguin {
	readonly name: string;
	readonly species: string;
	readonly blurb: string;
	readonly massKg: number;
	readonly heightM: number;
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

function scalePoint3D(point3d: Point3D, scalar: number): Point3D {
	return point<3>(
		x(point3d) * scalar,
		point3d[1]![0]! * scalar,
		z(point3d) * scalar
	);
}

function scalePoints(points: readonly Point3D[], scalar: number): Point3D[] {
	return points.map(vertex => scalePoint3D(vertex, scalar));
}

function translatePoints(points: readonly Point3D[], offset: Point3D): Point3D[] {
	return points.map(vertex => translate(vertex, offset) as Point3D);
}

function penguin(
	name: string,
	species: string,
	blurb: string,
	massKg: number,
	heightM: number,
	position: Point3D
): Penguin {
	return {
		name,
		species,
		blurb,
		massKg,
		heightM,
		position,
	};
}

function icebergSegments(): WorldSegment[] {
	const footprintScale = 1.65;
	const outline = scalePoints(withY(
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
	), footprintScale);
	const keel = scalePoints(withY(
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
	), footprintScale);
	const crackA = scalePoints([
		point<3>(-6, 0.03, -4),
		point<3>(-2, 0.03, -1),
		point<3>(2, 0.03, 2),
		point<3>(5, 0.03, 6),
	], footprintScale);
	const crackB = scalePoints([
		point<3>(3, 0.03, -8),
		point<3>(1, 0.03, -4),
		point<3>(-2, 0.03, -2),
		point<3>(-5, 0.03, 1),
	], footprintScale);
	const crackC = translatePoints(
		scalePoints(
			[
				point<3>(-5, 0.03, -2),
				point<3>(-1, 0.03, 0),
				point<3>(2, 0.03, 2),
				point<3>(5, 0.03, 5),
			],
			0.95
		),
		point<3>(10, 0, 8)
	);
	const crackD = translatePoints(
		scalePoints(
			[
				point<3>(-4, 0.03, -4),
				point<3>(-1, 0.03, -2),
				point<3>(2, 0.03, 1),
				point<3>(4, 0.03, 4),
			],
			0.9
		),
		point<3>(-13, 0, -8)
	);

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
	for (const [start, end] of loopSegments(crackC)) {
		segments.push(worldSegment(start, end, '#effdff', 1, 0.68));
	}
	for (const [start, end] of loopSegments(crackD)) {
		segments.push(worldSegment(start, end, '#d9f8ff', 0.95, 0.66));
	}

	for (const radius of [38, 54, 72]) {
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

function scaledPenguinShape(scale: number): ReturnType<typeof penguinShape> {
	const shape = penguinShape();
	return {
		body: shape.body.map(([start, end]) => [
			scalePoint3D(start, scale),
			scalePoint3D(end, scale),
		] as const),
		fill: shape.fill.map(vertex => scalePoint3D(vertex, scale)),
		beak: shape.beak.map(([start, end]) => [
			scalePoint3D(start, scale),
			scalePoint3D(end, scale),
		] as const),
	};
}

function penguinScale(penguin: Penguin): number {
	return penguin.heightM / 2.05;
}

function penguinSegments(penguin: Penguin, facing: Point3D): WorldSegment[] {
	const position = penguin.position;
	const scale = penguinScale(penguin);
	const rotation = lookAt(point<3>(0, 0, 0), facing, defaultUp);
	const scaled = scaledPenguinShape(scale);
	return [
		...applyTransform(scaled.body, rotation, position, PENGUIN_STROKE, 1.8 * scale, 0.96),
		...applyTransform(scaled.beak, rotation, position, BEAK_STROKE, 1.4 * scale, 0.92),
	];
}

function penguinBody(penguin: Penguin, facing: Point3D): PenguinBody {
	const position = penguin.position;
	const shape = scaledPenguinShape(penguinScale(penguin));
	const rotation = lookAt(point<3>(0, 0, 0), facing, defaultUp);
	return {
		centre: translate(position, point<3>(0, penguin.heightM * 0.55, 0)) as Point3D,
		outline: shape.fill.map(vertex =>
			translate(Quaternion.rotateVector(rotation, vertex), position) as Point3D
		),
	};
}

export function createPenguinWorld(): PenguinWorld {
	const penguins: Penguin[] = [
		penguin(
			'Mabel',
			'Adelie',
			'Collects smooth pebbles and does not respect personal space.',
			4.8,
			0.705,
			point<3>(-15.5, 0, -7.5)
		),
		penguin(
			'Dottie',
			'Gentoo',
			'Stares at the crack in the iceberg like it owes her money.',
			6.6,
			0.825,
			point<3>(10.5, 0, -11.8)
		),
		penguin(
			'Wobble',
			'Emperor',
			'Very tall. Absolutely certain this is his iceberg now.',
			31.0,
			1.18,
			point<3>(15.2, 0, 11.2)
		),
		penguin(
			'Pip',
			'Little',
			'Has discovered sliding and will not stop.',
			1.2,
			0.34,
			point<3>(-7.2, 0, 14.8)
		),
		penguin(
			'Aunt Sleet',
			'Chinstrap',
			'Judges your footwork, but quietly appreciates the visit.',
			5.1,
			0.72,
			point<3>(1.1, 0, 3.1)
		),
		penguin(
			'Rook',
			'Adelie',
			'Marches in tiny stern circles and then forgets why.',
			4.5,
			0.69,
			point<3>(-19.2, 0, 4.6)
		),
		penguin(
			'Purl',
			'Little',
			'Keeps trying to befriend the sea spray.',
			1.1,
			0.33,
			point<3>(8.2, 0, 18.3)
		),
		penguin(
			'Comet',
			'Gentoo',
			'Cuts diagonally across the ice as if late for something.',
			6.9,
			0.84,
			point<3>(18.8, 0, -2.2)
		),
		penguin(
			'Brine',
			'Chinstrap',
			'Looks windswept even when the air is still.',
			4.9,
			0.71,
			point<3>(-2.8, 0, -15.2)
		),
		penguin(
			'Halftone',
			'Adelie',
			'Will inspect your shoes with professional focus.',
			5.0,
			0.71,
			point<3>(6.4, 0, 8.6)
		),
		penguin(
			'Marchpane',
			'Emperor',
			'Stands apart from the colony and radiates ceremony.',
			28.4,
			1.14,
			point<3>(-11.8, 0, 17.1)
		),
		penguin(
			'Skiff',
			'Gentoo',
			'Seems deeply invested in a private navigation scheme.',
			6.3,
			0.81,
			point<3>(21.5, 0, 7.1)
		),
		penguin(
			'Flurry',
			'Chinstrap',
			'Keeps pausing mid-waddle to glare at the horizon.',
			5.0,
			0.72,
			point<3>(-22.5, 0, -10.4)
		),
		penguin(
			'Nori',
			'Little',
			'Moves like a dropped mitten skidding over polished ice.',
			1.3,
			0.34,
			point<3>(12.6, 0, 22.4)
		),
		penguin(
			'Ledger',
			'Adelie',
			'Keeps a suspiciously exact mental map of every pebble.',
			4.7,
			0.70,
			point<3>(-0.6, 0, 20.6)
		),
		penguin(
			'Tallow',
			'Emperor',
			'Occupies the ridge like a mildly disappointed monument.',
			30.2,
			1.17,
			point<3>(4.4, 0, -21.5)
		),
	];

	const penguinBodies = penguins.map((penguin, index) =>
		penguinBody(
			penguin,
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
			point<3>(-18.2, -0.45, 17.4),
			ICE_DEEP_STROKE,
			1.4,
			0.5
		),
		...applyTransform(
			box(4.6, 0.9, 3.2),
			Quaternion.fromAxisAngle(defaultUp, -Math.PI / 6),
			point<3>(22.1, -0.6, -20.5),
			ICE_DEEP_STROKE,
			1.25,
			0.42
		),
		...applyTransform(
			box(6.8, 1.1, 5.4),
			Quaternion.fromAxisAngle(defaultUp, -Math.PI / 5),
			point<3>(17.4, -0.5, 18.8),
			ICE_DEEP_STROKE,
			1.35,
			0.44
		),
		...applyTransform(
			box(7.2, 1.3, 4.8),
			Quaternion.fromAxisAngle(defaultUp, Math.PI / 7),
			point<3>(-24.4, -0.45, -14.8),
			ICE_DEEP_STROKE,
			1.45,
			0.46
		),
		...penguins.flatMap((penguin, index) =>
			penguinSegments(
				penguin,
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
			position: point<3>(0, EYE_HEIGHT, -20.5),
			yaw: 0,
			pitch: -0.06,
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

function penguinCaptionAnchor(penguin: Penguin): Point3D {
	return point<3>(
		x(penguin.position),
		penguin.position[1]![0]! + penguin.heightM + 0.45,
		z(penguin.position)
	);
}

function projectedWithinViewport(
	projected: Point2D | null,
	width: number,
	height: number
): projected is Point2D {
	return (
		projected != null &&
		x(projected) >= 0 &&
		x(projected) <= width &&
		y(projected) >= 0 &&
		y(projected) <= height
	);
}

export interface VisiblePenguinEncounter {
	readonly penguin: PenguinEncounter;
	readonly anchor: Point2D;
}

export function nearestVisiblePenguin(
	penguins: readonly Penguin[],
	pose: PlayerPose,
	width: number,
	height: number
): VisiblePenguinEncounter | null {
	let nearest: VisiblePenguinEncounter | null = null;

	for (const penguin of penguins) {
		const anchor = projectWorldPoint(
			penguinCaptionAnchor(penguin),
			pose,
			width,
			height
		);
		if (!projectedWithinViewport(anchor, width, height)) {
			continue;
		}

		const distance = Math.hypot(
			x(penguin.position) - x(pose.position),
			z(penguin.position) - z(pose.position)
		);

		if (nearest == null || distance < nearest.penguin.distance) {
			nearest = {
				penguin: {
					...penguin,
					distance,
				},
				anchor,
			};
		}
	}

	return nearest;
}

export interface TargetedPenguinEncounter extends VisiblePenguinEncounter {
	readonly screenDistance: number;
}

export function targetedVisiblePenguin(
	penguins: readonly Penguin[],
	pose: PlayerPose,
	width: number,
	height: number,
	maxScreenDistancePx: number
): TargetedPenguinEncounter | null {
	const centerX = width / 2;
	const centerY = height / 2;
	let target: TargetedPenguinEncounter | null = null;

	for (const penguin of penguins) {
		const anchor = projectWorldPoint(penguinCaptionAnchor(penguin), pose, width, height);
		if (!projectedWithinViewport(anchor, width, height)) {
			continue;
		}

		const distance = Math.hypot(
			x(penguin.position) - x(pose.position),
			z(penguin.position) - z(pose.position)
		);
		const screenDistance = Math.hypot(x(anchor) - centerX, y(anchor) - centerY);
		if (screenDistance > maxScreenDistancePx) {
			continue;
		}

		if (target == null || screenDistance < target.screenDistance || (screenDistance === target.screenDistance && distance < target.penguin.distance)) {
			target = {
				penguin: { ...penguin, distance },
				anchor,
				screenDistance,
			};
		}
	}

	return target;
}
