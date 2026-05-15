import {
	EYE_HEIGHT,
	type PlayerPose,
	projectWorldPoint,
	type RenderedSegment,
	renderScene as renderWireframeScene,
	type WorldSegment,
} from '#root/project/me/zemn/app/experiments/arena/scene.js';
import { Point2D, Point3D, point, x, y, z } from '#root/ts/math/cartesian.js';
import { styleSegment } from '#root/ts/math/wireframe_render.js';
import {
	and_then,
	and_then_flatten,
	Ok,
	type Result,
	result_collect,
} from '#root/ts/result/result.js';

export interface CameraKeyframe {
	readonly progress: number;
	readonly position: Point3D;
	readonly target: Point3D;
}

export interface ScenePolygon {
	readonly id: string;
	readonly points: readonly Point3D[];
	readonly fill: string;
	readonly opacity: number;
}

export interface RenderedPolygon {
	readonly id: string;
	readonly points: string;
	readonly fill: string;
	readonly opacity: number;
	readonly depth: number;
}

export interface RenderedSun {
	readonly cx: number;
	readonly cy: number;
	readonly radius: number;
	readonly visible: boolean;
}

export interface EndingsWorld {
	readonly segments: readonly WorldSegment[];
	readonly polygons: readonly ScenePolygon[];
}

export interface StoryCue {
	readonly id: string;
	readonly text: string;
	readonly start: number;
	readonly peak: number;
}

export interface StoryCueState extends StoryCue {
	readonly opacity: number;
	readonly translateY: number;
}

export const STORY_CUES: readonly StoryCue[] = [
	{
		id: 'sunsets',
		text: 'I liked sunsets, and I liked sunrises --',
		start: -0.14,
		peak: -0.02,
	},
	{
		id: 'endings',
		text: 'but I never liked endings.',
		start: 0.15,
		peak: 0.31,
	},
	{
		id: 'if-sunset',
		text: 'I think if, when the sun set --',
		start: 0.45,
		peak: 0.6,
	},
	{
		id: 'unknown-rise',
		text: 'we could never know when, or even if it would rise again --',
		start: 0.67,
		peak: 0.79,
	},
	{
		id: 'tragedy',
		text: 'then it would be a tragedy.',
		start: 0.94,
		peak: 0.99,
	},
];

export const SVG_WIDTH = 1200;
export const SVG_HEIGHT = 800;
export const SCROLL_LENGTH_VH = 420;
export const SUN_CENTER = point<3>(0, 10.2, 44);
export const SUN_RADIUS = 7.4;

const BLACK = '#050303';
const NEAR_BLACK = '#090505';
const SILHOUETTE_Y_OFFSET = -7.5;

function silhouettePoint(px: number, py: number, pz: number): Point3D {
	return point<3>(px, py + SILHOUETTE_Y_OFFSET, pz);
}

export const CAMERA_KEYFRAMES: readonly CameraKeyframe[] = [
	{
		progress: 0,
		position: point<3>(0, 7.8, -18),
		target: SUN_CENTER,
	},
	{
		progress: 0.34,
		position: point<3>(0, -1.8, -27),
		target: point<3>(0, 1.7 + SILHOUETTE_Y_OFFSET, 30),
	},
	{
		progress: 0.62,
		position: point<3>(0, -23.5, -42),
		target: point<3>(0, -11 + SILHOUETTE_Y_OFFSET, 36),
	},
	{
		progress: 1,
		position: point<3>(0, -49.5, -56),
		target: point<3>(0, -34 + SILHOUETTE_Y_OFFSET, 40),
	},
];

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export function clampProgress(progress: number): number {
	if (!Number.isFinite(progress)) {
		return 0;
	}

	return clamp(progress, 0, 1);
}

function smoothstep(value: number): number {
	const t = clampProgress(value);
	return t * t * (3 - 2 * t);
}

function interpolate(start: number, end: number, progress: number): number {
	return start + (end - start) * progress;
}

function interpolatePoint(
	start: Point3D,
	end: Point3D,
	progress: number
): Point3D {
	return point<3>(
		interpolate(x(start), x(end), progress),
		interpolate(y(start), y(end), progress),
		interpolate(z(start), z(end), progress)
	);
}

function poseLookingAt(position: Point3D, target: Point3D): PlayerPose {
	const dx = x(target) - x(position);
	const dy = y(target) - y(position);
	const dz = z(target) - z(position);
	const horizontalDistance = Math.hypot(dx, dz);

	return {
		position,
		yaw: Math.atan2(dx, dz),
		pitch: -Math.atan2(dy, horizontalDistance),
		verticalVelocity: 0,
	};
}

export function cameraPoseAtProgress(rawProgress: number): PlayerPose {
	const progress = clampProgress(rawProgress);
	let start = CAMERA_KEYFRAMES[0]!;
	let end = CAMERA_KEYFRAMES[CAMERA_KEYFRAMES.length - 1]!;

	for (let i = 0; i < CAMERA_KEYFRAMES.length - 1; i++) {
		const left = CAMERA_KEYFRAMES[i]!;
		const right = CAMERA_KEYFRAMES[i + 1]!;
		if (progress >= left.progress && progress <= right.progress) {
			start = left;
			end = right;
			break;
		}
	}

	const localProgress =
		end.progress === start.progress
			? 0
			: (progress - start.progress) / (end.progress - start.progress);
	const eased = smoothstep(localProgress);
	return poseLookingAt(
		interpolatePoint(start.position, end.position, eased),
		interpolatePoint(start.target, end.target, eased)
	);
}

function cueOpacity(cue: StoryCue, progress: number): number {
	if (progress <= cue.start) {
		return cue.peak === progress ? 1 : 0;
	}

	if (progress >= cue.peak) {
		return 1;
	}

	return smoothstep((progress - cue.start) / (cue.peak - cue.start));
}

export function cueStatesAtProgress(rawProgress: number): StoryCueState[] {
	const progress = clampProgress(rawProgress);
	return STORY_CUES.map(cue => {
		const opacity = cueOpacity(cue, progress);

		return {
			...cue,
			opacity,
			translateY: (1 - opacity) * 22,
		};
	});
}

function worldSegment(
	start: Point3D,
	end: Point3D,
	stroke: string,
	width: number,
	opacity = 1
): WorldSegment {
	return styleSegment([start, end], {
		stroke,
		width,
		opacity,
	}) as WorldSegment;
}

function rectangleXY(
	id: string,
	left: number,
	right: number,
	bottom: number,
	top: number,
	depth: number,
	fill = BLACK,
	opacity = 1
): ScenePolygon {
	return {
		id,
		points: [
			silhouettePoint(left, bottom, depth),
			silhouettePoint(right, bottom, depth),
			silhouettePoint(right, top, depth),
			silhouettePoint(left, top, depth),
		],
		fill,
		opacity,
	};
}

function meshFace(
	id: string,
	points: readonly Point3D[],
	fill = BLACK
): ScenePolygon {
	return {
		id,
		points,
		fill,
		opacity: 1,
	};
}

function cuboidMesh(
	id: string,
	cx: number,
	baseY: number,
	depth: number,
	width: number,
	height: number,
	thickness: number
): ScenePolygon[] {
	const left = cx - width / 2;
	const right = cx + width / 2;
	const bottom = baseY;
	const top = baseY + height;
	const front = depth - thickness / 2;
	const back = depth + thickness / 2;
	const leftBottomFront = silhouettePoint(left, bottom, front);
	const rightBottomFront = silhouettePoint(right, bottom, front);
	const leftTopFront = silhouettePoint(left, top, front);
	const rightTopFront = silhouettePoint(right, top, front);
	const leftBottomBack = silhouettePoint(left, bottom, back);
	const rightBottomBack = silhouettePoint(right, bottom, back);
	const leftTopBack = silhouettePoint(left, top, back);
	const rightTopBack = silhouettePoint(right, top, back);

	return [
		meshFace(id, [
			leftBottomFront,
			rightBottomFront,
			rightTopFront,
			leftTopFront,
		]),
		meshFace(`${id}-right`, [
			rightBottomFront,
			rightBottomBack,
			rightTopBack,
			rightTopFront,
		]),
		meshFace(`${id}-back`, [
			rightBottomBack,
			leftBottomBack,
			leftTopBack,
			rightTopBack,
		]),
		meshFace(`${id}-left`, [
			leftBottomBack,
			leftBottomFront,
			leftTopFront,
			leftTopBack,
		]),
		meshFace(`${id}-top`, [
			leftTopFront,
			rightTopFront,
			rightTopBack,
			leftTopBack,
		]),
	];
}

function pyramidMesh(
	id: string,
	cx: number,
	baseY: number,
	depth: number,
	width: number,
	height: number,
	thickness: number
): ScenePolygon[] {
	const left = cx - width / 2;
	const right = cx + width / 2;
	const front = depth - thickness / 2;
	const back = depth + thickness / 2;
	const leftFront = silhouettePoint(left, baseY, front);
	const rightFront = silhouettePoint(right, baseY, front);
	const leftBack = silhouettePoint(left, baseY, back);
	const rightBack = silhouettePoint(right, baseY, back);
	const apex = silhouettePoint(cx, baseY + height, depth);

	return [
		meshFace(id, [leftFront, rightFront, apex]),
		meshFace(`${id}-right`, [rightFront, rightBack, apex]),
		meshFace(`${id}-back`, [rightBack, leftBack, apex]),
		meshFace(`${id}-left`, [leftBack, leftFront, apex]),
		meshFace(`${id}-base`, [leftBack, rightBack, rightFront, leftFront]),
	];
}

function circleXY(
	id: string,
	cx: number,
	cy: number,
	depth: number,
	radius: number,
	vertices = 18,
	fill = BLACK
): ScenePolygon {
	const points: Point3D[] = [];
	for (let i = 0; i < vertices; i++) {
		const angle = (i / vertices) * Math.PI * 2;
		points.push(
			silhouettePoint(
				cx + Math.cos(angle) * radius,
				cy + Math.sin(angle) * radius,
				depth
			)
		);
	}

	return {
		id,
		points,
		fill,
		opacity: 1,
	};
}

function torso(
	id: string,
	shoulderX: number,
	shoulderY: number,
	hipX: number,
	hipY: number,
	depth: number,
	width: number
): ScenePolygon {
	return {
		id,
		points: [
			silhouettePoint(shoulderX - width * 0.5, shoulderY, depth),
			silhouettePoint(shoulderX + width * 0.5, shoulderY, depth),
			silhouettePoint(hipX + width * 0.42, hipY, depth),
			silhouettePoint(hipX - width * 0.42, hipY, depth),
		],
		fill: BLACK,
		opacity: 1,
	};
}

function hillPolygon(): ScenePolygon {
	const ridge: readonly Point3D[] = [
		silhouettePoint(-260, 6.5, 34),
		silhouettePoint(-185, 5.9, 33),
		silhouettePoint(-120, 5.2, 32),
		silhouettePoint(-78, 4.5, 31),
		silhouettePoint(-56, 3.4, 30),
		silhouettePoint(-38, 2.5, 29),
		silhouettePoint(-19, 1.45, 29),
		silhouettePoint(-7, 1.05, 29.5),
		silhouettePoint(0, 1.28, 30),
		silhouettePoint(7, 1.04, 29.5),
		silhouettePoint(20, 1.55, 29),
		silhouettePoint(39, 2.6, 29),
		silhouettePoint(58, 3.8, 30),
		silhouettePoint(80, 4.7, 31),
		silhouettePoint(122, 5.25, 32),
		silhouettePoint(188, 6, 33),
		silhouettePoint(262, 6.55, 34),
	];

	return {
		id: 'hill',
		points: [
			...ridge,
			silhouettePoint(420, -180, 31),
			silhouettePoint(-420, -180, 31),
		],
		fill: BLACK,
		opacity: 1,
	};
}

function distantRidgePolygon(): ScenePolygon {
	return {
		id: 'distant-ridge',
		points: [
			silhouettePoint(-80, -2.8, 55),
			silhouettePoint(-46, -2.1, 55),
			silhouettePoint(-18, -1.65, 54),
			silhouettePoint(8, -1.85, 54),
			silhouettePoint(36, -1.45, 55),
			silhouettePoint(78, -2.6, 55),
			silhouettePoint(84, -26, 55),
			silhouettePoint(-84, -26, 55),
		],
		fill: '#180909',
		opacity: 0.42,
	};
}

function createBenchPolygons(): ScenePolygon[] {
	return [
		rectangleXY('bench-back', -3.65, 3.65, 1.72, 2.18, 29.65),
		rectangleXY('bench-seat', -3.95, 3.95, 0.86, 1.17, 29.15),
		rectangleXY('bench-left-leg', -3.1, -2.72, -0.25, 0.92, 29.2),
		rectangleXY('bench-right-leg', 2.72, 3.1, -0.25, 0.92, 29.2),
		rectangleXY('bench-centre-leg', -0.18, 0.18, -0.15, 0.96, 29.2),
	];
}

function createTreePolygons(
	id: string,
	cx: number,
	baseY: number,
	depth: number,
	scale: number
): ScenePolygon[] {
	const trunkWidth = 0.64 * scale;
	const trunkHeight = 3.2 * scale;
	const trunkThickness = 0.72 * scale;
	const lowerBottom = baseY + 1.45 * scale;
	const middleBottom = baseY + 3.6 * scale;
	const upperBottom = baseY + 5.55 * scale;

	return [
		...cuboidMesh(
			`${id}-trunk`,
			cx,
			baseY,
			depth,
			trunkWidth,
			trunkHeight,
			trunkThickness
		),
		...pyramidMesh(
			`${id}-lower-boughs`,
			cx,
			lowerBottom,
			depth,
			5.8 * scale,
			5.65 * scale,
			2.6 * scale
		),
		...pyramidMesh(
			`${id}-middle-boughs`,
			cx,
			middleBottom,
			depth,
			4.5 * scale,
			5.25 * scale,
			2.15 * scale
		),
		...pyramidMesh(
			`${id}-upper-boughs`,
			cx,
			upperBottom,
			depth,
			3.1 * scale,
			5.05 * scale,
			1.65 * scale
		),
	];
}

function createTreeFramePolygons(): ScenePolygon[] {
	return [
		...createTreePolygons('left-foreground-tree', -11.2, -2.7, 24.2, 1.25),
		...createTreePolygons('right-foreground-tree', 11.8, -2.8, 24.6, 1.32),
		...createTreePolygons('left-mid-tree', -19.6, -1.9, 31.5, 1.65),
		...createTreePolygons('right-mid-tree', 20.4, -2, 32.2, 1.58),
		...createTreePolygons('left-distant-tree', -42.5, -3.4, 50.5, 2.05),
		...createTreePolygons('right-distant-tree', 43.5, -3.5, 51.5, 1.95),
	];
}

function createPeoplePolygons(): ScenePolygon[] {
	return [
		circleXY('left-head', -0.82, 2.78, 28.72, 0.42),
		circleXY('right-head', 0.78, 2.72, 28.68, 0.43),
		torso('left-torso', -0.9, 2.18, -0.42, 1.02, 28.75, 0.9),
		torso('right-torso', 0.92, 2.12, 0.42, 1.02, 28.7, 0.92),
		rectangleXY('left-lap', -1.55, -0.12, 0.74, 1.08, 28.62),
		rectangleXY('right-lap', 0.12, 1.56, 0.72, 1.06, 28.6),
	];
}

export function createEndingsWorld(): EndingsWorld {
	return {
		polygons: [
			distantRidgePolygon(),
			hillPolygon(),
			...createTreeFramePolygons(),
			...createBenchPolygons(),
			...createPeoplePolygons(),
		],
		segments: [
			worldSegment(
				silhouettePoint(-3.35, 1.94, 29.05),
				silhouettePoint(3.35, 1.94, 29.05),
				NEAR_BLACK,
				2.2
			),
			worldSegment(
				silhouettePoint(-3.55, 1.02, 28.92),
				silhouettePoint(3.55, 1.02, 28.92),
				NEAR_BLACK,
				2.4
			),
		],
	};
}

export function projectPolygon(
	polygon: ScenePolygon,
	pose: PlayerPose,
	width: number,
	height: number
): Result<RenderedPolygon | null, Error> {
	return and_then(
		result_collect(
			polygon.points.map(vertex =>
				projectWorldPoint(vertex, pose, width, height)
			)
		),
		projected => {
			if (projected.some(point2d => point2d == null)) {
				return null;
			}

			const projectedPoints = projected as Point2D[];
			const depth =
				polygon.points.reduce(
					(total, vertex) =>
						total +
						Math.hypot(
							x(vertex) - x(pose.position),
							y(vertex) - y(pose.position),
							z(vertex) - z(pose.position)
						),
					0
				) / polygon.points.length;

			return {
				id: polygon.id,
				points: projectedPoints
					.map(
						point2d =>
							`${x(point2d).toFixed(2)},${y(point2d).toFixed(2)}`
					)
					.join(' '),
				fill: polygon.fill,
				opacity: polygon.opacity,
				depth,
			};
		}
	);
}

export function renderPolygons(
	polygons: readonly ScenePolygon[],
	pose: PlayerPose,
	width: number,
	height: number
): Result<RenderedPolygon[], Error> {
	return and_then(
		result_collect(
			polygons.map(polygon =>
				projectPolygon(polygon, pose, width, height)
			)
		),
		rendered =>
			rendered
				.filter(
					(polygon): polygon is RenderedPolygon => polygon != null
				)
				.sort((left, right) => right.depth - left.depth)
	);
}

export function renderSun(
	pose: PlayerPose,
	width: number,
	height: number
): Result<RenderedSun, Error> {
	return and_then_flatten(
		projectWorldPoint(SUN_CENTER, pose, width, height),
		(projectedCenter): Result<RenderedSun, Error> => {
			if (projectedCenter == null) {
				return Ok<RenderedSun, Error>({
					cx: width / 2,
					cy: height / 2,
					radius: 0,
					visible: false,
				});
			}

			return and_then(
				projectWorldPoint(
					point<3>(
						x(SUN_CENTER) + SUN_RADIUS,
						y(SUN_CENTER),
						z(SUN_CENTER)
					),
					pose,
					width,
					height
				),
				(projectedEdge): RenderedSun => {
					const radius =
						projectedEdge == null
							? Math.min(width, height) * 0.08
							: Math.hypot(
									x(projectedEdge) - x(projectedCenter),
									y(projectedEdge) - y(projectedCenter)
								);

					return {
						cx: x(projectedCenter),
						cy: y(projectedCenter),
						radius,
						visible: true,
					};
				}
			);
		}
	);
}

export function renderEndingsScene(
	world: EndingsWorld,
	pose: PlayerPose,
	width: number,
	height: number
): Result<
	{
		readonly segments: readonly RenderedSegment[];
		readonly polygons: readonly RenderedPolygon[];
		readonly sun: RenderedSun;
	},
	Error
> {
	return and_then_flatten(
		renderPolygons(world.polygons, pose, width, height),
		polygons =>
			and_then_flatten(renderSun(pose, width, height), sun =>
				and_then(
					renderWireframeScene(world.segments, pose, width, height),
					segments => ({
						segments,
						polygons,
						sun,
					})
				)
			)
	);
}

export function darknessAtProgress(progress: number): number {
	return smoothstep((clampProgress(progress) - 0.72) / 0.22);
}

export function startPose(): PlayerPose {
	return {
		...cameraPoseAtProgress(0),
		position: point<3>(0, 7.8, -18),
		verticalVelocity: 0,
	};
}

export function horizonEyeHeight(): number {
	return EYE_HEIGHT;
}
