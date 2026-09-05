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
	result_collect,
	zipped,
} from '#root/ts/result/result.js';

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

export interface Perspective {
	readonly width: number;
	readonly height: number;
	readonly nearPlane: number;
	readonly farPlane: number;
	readonly focalScale: number;
}

export function styleSegment(
	segment: Segment3D,
	style: Pick<StyledSegment3D, 'stroke' | 'width' | 'opacity'>
): StyledSegment3D {
	return Object.assign(segment, style);
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
	const focalPixels =
		Math.min(projection.width, projection.height) * projection.focalScale;
	const depth = Math.max(z(cameraPoint), projection.nearPlane);
	const projectedScale = focalPixels / depth;

	return point<2>(
		projection.width / 2 + x(cameraPoint) * projectedScale,
		projection.height / 2 - y(cameraPoint) * projectedScale
	);
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

function renderSegment(
	segment: StyledSegment3D,
	pose: YawPitchPose,
	projection: Perspective
): Result<RenderedSegment2D | null, Error> {
	return zipped(
		cameraSpacePointFromPose(segment[0], pose),
		cameraSpacePointFromPose(segment[1], pose),
		(start, end) => {
			const clipped = clipSegmentToNearPlane(
				start,
				end,
				projection.nearPlane
			);
			if (clipped == null) {
				return null;
			}

			const [visibleStart, visibleEnd] = clipped;
			const depth = (z(visibleStart) + z(visibleEnd)) / 2;
			if (depth > projection.farPlane) {
				return null;
			}

			const projectedStart = projectCameraPoint(visibleStart, projection);
			const projectedEnd = projectCameraPoint(visibleEnd, projection);
			const fade = 1 - Math.min(depth / projection.farPlane, 0.82);

			return {
				x1: x(projectedStart),
				y1: y(projectedStart),
				x2: x(projectedEnd),
				y2: y(projectedEnd),
				stroke: segment.stroke,
				width: segment.width,
				opacity: Math.max(0.14, segment.opacity * fade),
				depth,
			};
		}
	);
}

export function renderSegments(
	segments: readonly StyledSegment3D[],
	pose: YawPitchPose,
	projection: Perspective
): Result<RenderedSegment2D[], Error> {
	return pipe(
		result_collect(
			segments.map(segment => renderSegment(segment, pose, projection))
		),
		map_result(rendered =>
			rendered
				.filter(
					(segment): segment is RenderedSegment2D => segment != null
				)
				.sort((left, right) => right.depth - left.depth)
		)
	);
}

/** Filled faces share the same camera and projection as wireframe segments. */
export interface StyledFace3D {
	readonly vertices: readonly Point3D[];
	readonly fill: string;
	/** Explicit layers are useful for terrain decals; ordinary solids share a layer. */
	readonly layer?: number;
	readonly doubleSided?: boolean;
}

export interface RenderedFace2D {
	readonly source?: StyledFace3D;
	readonly path: string;
	readonly fill: string;
	readonly depth: number;
	readonly layer: number;
}

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
	return a.layer - b.layer || b.depth - a.depth;
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
		const screen = new Map<Point3D, Point2D>();
		for (const face of faces) {
			if (options.cache?.has(face)) {
				const cached = options.cache.get(face);
				if (cached) rendered.push(cached);
				continue;
			}
			options.cache?.set(face, null);
			if (face.vertices.length < 3) continue;
			const vertices = face.vertices.map(vertex => {
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
			if (!face.doubleSided && facing >= -1e-12) continue;
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
					p = projectCameraPoint(vertex, projection);
					screen.set(vertex, p);
				}
				left = Math.min(left, x(p));
				right = Math.max(right, x(p));
				top = Math.min(top, y(p));
				bottom = Math.max(bottom, y(p));
				path += `${path ? 'L' : 'M'}${x(p).toFixed(2)},${y(p).toFixed(2)}`;
			}
			if (
				right < 0 ||
				left > projection.width ||
				bottom < 0 ||
				top > projection.height
			)
				continue;
			const result = {
				source: face,
				path: path + 'Z',
				fill: face.fill,
				depth:
					clipped.reduce((sum, p) => sum + z(p), 0) / clipped.length,
				layer: face.layer ?? 0,
			};
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
