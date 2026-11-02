import {
	cameraSpacePointFromPose,
	cameraSpaceTransformFromPose,
	orientationFromYawPitch,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { Point2D, Point3D, point, x, y, z } from '#root/ts/math/cartesian.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import type { Segment3D } from '#root/ts/math/wireframe.js';
import { pipe } from '#root/ts/pipe.js';
import {
	and_then,
	and_then_flatten,
	map_result,
	type Result,
} from '#root/ts/result/result.js';

/** Object-based scene API used by existing wireframe applications. */
export type StyledSegment3D = Segment3D & {
	readonly stroke: string;
	readonly width: number;
	readonly opacity: number;
};

export interface RenderedSegment2D {
	readonly x1: number;
	readonly y1: number;
	readonly x2: number;
	readonly y2: number;
	readonly stroke: string;
	readonly width: number;
	readonly opacity: number;
	readonly depth: number;
}

export function styleSegment(
	segment: Segment3D,
	style: Pick<StyledSegment3D, 'stroke' | 'width' | 'opacity'>
): StyledSegment3D {
	return Object.assign(segment, style);
}

/** Adapt existing scenes at the boundary; projection stays shared with the functional API. */
export function renderSegments(
	segments: readonly StyledSegment3D[],
	pose: YawPitchPose,
	projection: Perspective
): Result<RenderedSegment2D[], Error> {
	return and_then(cameraSpaceTransformFromPose(pose), toCamera =>
		projectSegments(
			segments.map(segment =>
				wireSegment(
					segment[0],
					segment[1],
					segment.stroke,
					segment.width,
					segment.opacity
				)
			),
			toCamera,
			cameraProjector(
				projection.width,
				projection.height,
				projection.focalScale,
				projection.nearPlane
			),
			projection.nearPlane,
			projection.farPlane
		).map(segment =>
			segment((x1, y1, x2, y2, stroke, width, opacity, depth) => ({
				x1,
				y1,
				x2,
				y2,
				stroke,
				width,
				opacity,
				depth,
			}))
		)
	);
}

/** Church products keep segment fields local so minifiers can rename them. */
export type WireSegment3D = <R>(
	use: (
		start: Point3D,
		end: Point3D,
		stroke: string,
		width: number,
		opacity: number
	) => R
) => R;

export type ProjectedSegment2D = <R>(
	use: (
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		stroke: string,
		width: number,
		opacity: number,
		depth: number
	) => R
) => R;

export interface Perspective {
	readonly width: number;
	readonly height: number;
	readonly nearPlane: number;
	readonly farPlane: number;
	readonly focalScale: number;
}

export function wireSegment(
	start: Point3D,
	end: Point3D,
	stroke: string,
	width: number,
	opacity: number
): WireSegment3D {
	return use => use(start, end, stroke, width, opacity);
}

export function perspective(
	width: number,
	height: number,
	options: Partial<
		Pick<Perspective, 'nearPlane' | 'farPlane' | 'focalScale'>
	> = {}
): Perspective {
	return {
		width,
		height,
		nearPlane: options.nearPlane ?? 0.1,
		farPlane: options.farPlane ?? 90,
		focalScale: options.focalScale ?? 0.9,
	};
}

export function clipSegmentToNearPlane(
	start: Point3D,
	end: Point3D,
	nearPlane: number
): readonly [Point3D, Point3D] | null {
	const z1 = z(start);
	const z2 = z(end);

	if (z1 < nearPlane && z2 < nearPlane) {
		return null;
	}

	if (z1 >= nearPlane && z2 >= nearPlane) {
		return [start, end] as const;
	}

	const interpolation = (nearPlane - z1) / (z2 - z1);
	const clipped = point<3>(
		x(start) + (x(end) - x(start)) * interpolation,
		y(start) + (y(end) - y(start)) * interpolation,
		nearPlane
	);

	return z1 < nearPlane
		? ([clipped, end] as const)
		: ([start, clipped] as const);
}

export function projectCameraPoint(
	cameraPoint: Point3D,
	projection: Perspective
): Point2D {
	return projectPoint(
		cameraPoint,
		projection.width / 2,
		projection.height / 2,
		Math.min(projection.width, projection.height) * projection.focalScale,
		projection.nearPlane
	);
}

function projectPoint(
	cameraPoint: Point3D,
	cx: number,
	cy: number,
	focalPixels: number,
	nearPlane: number
): Point2D {
	const scale = focalPixels / Math.max(z(cameraPoint), nearPlane);
	return point<2>(cx + x(cameraPoint) * scale, cy - y(cameraPoint) * scale);
}

/** Compile viewport scalars once, with no projection record in the frame loop. */
export function cameraProjector(
	width: number,
	height: number,
	focalScale = 0.9,
	nearPlane = 0.1
): (cameraPoint: Point3D) => Point2D {
	const focalPixels = Math.min(width, height) * focalScale;
	const cx = width / 2,
		cy = height / 2;
	return cameraPoint =>
		projectPoint(cameraPoint, cx, cy, focalPixels, nearPlane);
}

export function projectWorldPoint(
	worldPoint: Point3D,
	pose: YawPitchPose,
	projection: Perspective
): Result<Point2D | null, Error> {
	return pipe(
		cameraSpacePointFromPose(worldPoint, pose),
		map_result(cameraPoint =>
			z(cameraPoint) < projection.nearPlane
				? null
				: projectCameraPoint(cameraPoint, projection)
		)
	);
}

function renderedSegment(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	stroke: string,
	width: number,
	opacity: number,
	depth: number
): ProjectedSegment2D {
	return use => use(x1, y1, x2, y2, stroke, width, opacity, depth);
}

/** Transform and project a wire model with a camera compiled once per frame. */
export function projectSegments(
	segments: readonly WireSegment3D[],
	toCamera: (world: Point3D) => Point3D,
	project: (cameraPoint: Point3D) => Point2D,
	nearPlane = 0.1,
	farPlane = 90
): ProjectedSegment2D[] {
	const rendered: ProjectedSegment2D[] = [];
	for (const segment of segments)
		segment((start, end, stroke, width, opacity) => {
			const clipped = clipSegmentToNearPlane(
				toCamera(start),
				toCamera(end),
				nearPlane
			);
			if (!clipped) return;
			const [visibleStart, visibleEnd] = clipped;
			const depth = (z(visibleStart) + z(visibleEnd)) / 2;
			if (depth > farPlane) return;
			const projectedStart = project(visibleStart),
				projectedEnd = project(visibleEnd);
			const alpha = Math.max(
				0.14,
				opacity * (1 - Math.min(depth / farPlane, 0.82))
			);
			rendered.push(
				renderedSegment(
					x(projectedStart),
					y(projectedStart),
					x(projectedEnd),
					y(projectedEnd),
					stroke,
					width,
					alpha,
					depth
				)
			);
		});
	return rendered.sort((left, right) =>
		left((_x1, _y1, _x2, _y2, _stroke, _width, _opacity, depth) =>
			right(
				(_a, _b, _c, _d, _s, _w, _o, otherDepth) => otherDepth - depth
			)
		)
	);
}

/** Filled faces share the same camera and projection as wireframe segments. */
export type StyledFace3D = <R>(
	use: (
		vertices: readonly Point3D[],
		fill: string,
		layer: number,
		doubleSided: boolean
	) => R
) => R;

/** Church-encoded product: field names are local bindings, never runtime keys.
 * Vertices must remain immutable so geometry/projection caches stay valid.
 */
export function styledFace(
	vertices: readonly Point3D[],
	fill: string,
	layer = 0,
	doubleSided = false
): StyledFace3D {
	return use => use(vertices, fill, layer, doubleSided);
}

export const faceVertices = (face: StyledFace3D): readonly Point3D[] =>
	face(vertices => vertices);
export const faceFill = (face: StyledFace3D): string =>
	face((_vertices, fill) => fill);
export const faceLayer = (face: StyledFace3D): number =>
	face((_vertices, _fill, layer) => layer);
export const faceDoubleSided = (face: StyledFace3D): boolean =>
	face((_vertices, _fill, _layer, doubleSided) => doubleSided);

export type RenderedFace2D = <R>(
	use: (
		source: StyledFace3D,
		path: string,
		fill: string,
		depth: number,
		layer: number
	) => R
) => R;

function renderedFace(
	source: StyledFace3D,
	path: string,
	fill: string,
	depth: number,
	layer: number
): RenderedFace2D {
	return use => use(source, path, fill, depth, layer);
}

export const renderedSource = (face: RenderedFace2D): StyledFace3D =>
	face(source => source);
export const renderedPath = (face: RenderedFace2D): string =>
	face((_source, path) => path);
export const renderedFill = (face: RenderedFace2D): string =>
	face((_source, _path, fill) => fill);

export function clipPolygonToDepth(
	vertices: readonly Point3D[],
	depth: number,
	keepBeyond: boolean
): Point3D[] {
	const clipped: Point3D[] = [];
	for (let i = 0; i < vertices.length; i++) {
		const a = vertices[i]!,
			b = vertices[(i + 1) % vertices.length]!;
		const aInside = keepBeyond ? z(a) >= depth : z(a) <= depth;
		const bInside = keepBeyond ? z(b) >= depth : z(b) <= depth;
		if (aInside) clipped.push(a);
		if (aInside !== bInside) {
			const t = (depth - z(a)) / (z(b) - z(a));
			clipped.push(
				point<3>(
					x(a) + (x(b) - x(a)) * t,
					y(a) + (y(b) - y(a)) * t,
					depth
				)
			);
		}
	}
	return clipped;
}

export function compareRenderedFaces(
	a: RenderedFace2D,
	b: RenderedFace2D
): number {
	return a((_source, _path, _fill, depth, layer) =>
		b(
			(_source, _path, _fill, otherDepth, otherLayer) =>
				layer - otherLayer || otherDepth - depth
		)
	);
}

/** Painter's ordering for small convex meshes, with clipping and back-face culling. */
export function renderFaces(
	faces: readonly StyledFace3D[],
	pose: YawPitchPose,
	projection: Perspective,
	options: {
		/** Preserve geometric ordering supplied by a BSP traversal. */
		preserveOrder?: boolean;
		/** Only reuse while the camera and projection are unchanged; faces must be immutable. */
		cache?: WeakMap<StyledFace3D, RenderedFace2D | null>;
	} = {}
): Result<RenderedFace2D[], Error> {
	return and_then(cameraSpaceTransformFromPose(pose), transform => {
		const rendered: RenderedFace2D[] = [];
		const transformed = new Map<Point3D, Point3D>();
		const screen = new Map<Point3D, readonly [number, number, string]>();
		const focal =
			Math.min(projection.width, projection.height) *
			projection.focalScale;
		const centerX = projection.width / 2,
			centerY = projection.height / 2;
		for (const face of faces) {
			if (options.cache?.has(face)) {
				const cached = options.cache.get(face);
				if (cached) rendered.push(cached);
				continue;
			}
			options.cache?.set(face, null);
			const worldVertices = faceVertices(face);
			if (worldVertices.length < 3) continue;
			const vertices = worldVertices.map(vertex => {
				let cached = transformed.get(vertex);
				if (!cached) {
					cached = transform(vertex);
					transformed.set(vertex, cached);
				}
				return cached;
			});
			const a = vertices[0]!;
			let facing = 0;
			// Split polygons may start with collinear vertices. Sum the complete fan.
			for (let i = 1; i + 1 < vertices.length; i++) {
				const b = vertices[i]!,
					c = vertices[i + 1]!;
				const ux = x(b) - x(a),
					uy = y(b) - y(a),
					uz = z(b) - z(a);
				const vx = x(c) - x(a),
					vy = y(c) - y(a),
					vz = z(c) - z(a);
				facing +=
					(uy * vz - uz * vy) * x(a) +
					(uz * vx - ux * vz) * y(a) +
					(ux * vy - uy * vx) * z(a);
			}
			if (!faceDoubleSided(face) && facing >= -1e-12) continue;
			let clipped = vertices;
			if (clipped.some(p => z(p) < projection.nearPlane))
				clipped = clipPolygonToDepth(
					clipped,
					projection.nearPlane,
					true
				);
			if (clipped.some(p => z(p) > projection.farPlane))
				clipped = clipPolygonToDepth(
					clipped,
					projection.farPlane,
					false
				);
			if (clipped.length < 3) continue;
			let path = '',
				left = Infinity,
				right = -Infinity,
				top = Infinity,
				bottom = -Infinity;
			for (const vertex of clipped) {
				let p = screen.get(vertex);
				if (!p) {
					const scale =
						focal / Math.max(z(vertex), projection.nearPlane);
					const sx = centerX + x(vertex) * scale,
						sy = centerY - y(vertex) * scale;
					p = [sx, sy, `${sx.toFixed(2)},${sy.toFixed(2)}`];
					screen.set(vertex, p);
				}
				left = Math.min(left, p[0]);
				right = Math.max(right, p[0]);
				top = Math.min(top, p[1]);
				bottom = Math.max(bottom, p[1]);
				path += `${path ? 'L' : 'M'}${p[2]}`;
			}
			if (
				right < 0 ||
				left > projection.width ||
				bottom < 0 ||
				top > projection.height
			)
				continue;
			const result = renderedFace(
				face,
				path + 'Z',
				faceFill(face),
				clipped.reduce((sum, p) => sum + z(p), 0) / clipped.length,
				faceLayer(face)
			);
			rendered.push(result);
			options.cache?.set(face, result);
		}
		return options.preserveOrder
			? rendered
			: rendered.sort(compareRenderedFaces);
	});
}

/** Reverse the same perspective projection for click/touch picking on a horizontal plane. */
export function groundPointFromScreen(
	screen: Point2D,
	pose: YawPitchPose,
	projection: Perspective,
	height = 0
): Result<Point3D | null, Error> {
	const focal =
		Math.min(projection.width, projection.height) * projection.focalScale;
	const ray = point<3>(
		(x(screen) - projection.width / 2) / focal,
		(projection.height / 2 - y(screen)) / focal,
		1
	);
	return and_then_flatten(
		orientationFromYawPitch(pose.yaw, pose.pitch),
		rotation =>
			and_then(Quaternion.rotateVector(rotation, ray), direction => {
				if (Math.abs(y(direction)) < 0.000001) return null;
				const t = (height - y(pose.position)) / y(direction);
				return t < 0
					? null
					: point<3>(
							x(pose.position) + x(direction) * t,
							height,
							z(pose.position) + z(direction) * t
						);
			})
	);
}
