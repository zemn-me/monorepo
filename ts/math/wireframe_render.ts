import {
	cameraSpacePointFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { point, Point2D, Point3D, x, y, z } from '#root/ts/math/cartesian.js';
import type { Segment3D } from '#root/ts/math/wireframe.js';
import { pipe } from '#root/ts/pipe.js';
import { and_then_flatten, map_result, Ok, type Result, result_collect } from '#root/ts/result/result.js';


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
	options: Partial<Pick<Perspective, 'nearPlane' | 'farPlane' | 'focalScale'>> = {}
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

	return z1 < nearPlane ? [clipped, end] as const : [start, clipped] as const;
}

export function projectCameraPoint(
	cameraPoint: Point3D,
	projection: Perspective
): Point2D {
	const focalPixels = Math.min(projection.width, projection.height) * projection.focalScale;
	const depth = Math.max(z(cameraPoint), projection.nearPlane);
	const projectedScale = focalPixels / depth;

	return point<2>(
		(projection.width / 2) + (x(cameraPoint) * projectedScale),
		(projection.height / 2) - (y(cameraPoint) * projectedScale)
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

export function renderSegments(
	segments: readonly StyledSegment3D[],
	pose: YawPitchPose,
	projection: Perspective
): Result<RenderedSegment2D[], Error> {
	return pipe(
		result_collect(
			segments.map(segment =>
				and_then_flatten(
					cameraSpacePointFromPose(segment[0], pose),
					start => and_then_flatten(
						cameraSpacePointFromPose(segment[1], pose),
						end => {
							const clipped = clipSegmentToNearPlane(start, end, projection.nearPlane);

							if (clipped == null) {
								return Ok<RenderedSegment2D | null, Error>(null);
							}

							const [visibleStart, visibleEnd] = clipped;
							const depth = (z(visibleStart) + z(visibleEnd)) / 2;

							if (depth > projection.farPlane) {
								return Ok<RenderedSegment2D | null, Error>(null);
							}

							const projectedStart = projectCameraPoint(visibleStart, projection);
							const projectedEnd = projectCameraPoint(visibleEnd, projection);
							const fade = 1 - Math.min(depth / projection.farPlane, 0.82);

							return Ok({
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
					)
				)
			)
		),
		map_result(rendered =>
			rendered
				.filter((segment): segment is RenderedSegment2D => segment != null)
				.sort((left, right) => right.depth - left.depth)
		)
	);
}
