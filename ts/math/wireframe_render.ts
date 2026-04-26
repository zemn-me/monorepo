import {
	cameraSpacePointFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { point, Point2D, Point3D, x, y, z } from '#root/ts/math/cartesian.js';
import type { Segment3D } from '#root/ts/math/wireframe.js';

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
): Point2D | null {
	const cameraPoint = cameraSpacePointFromPose(worldPoint, pose);
	if (z(cameraPoint) < projection.nearPlane) {
		return null;
	}

	return projectCameraPoint(cameraPoint, projection);
}

export function renderSegments(
	segments: readonly StyledSegment3D[],
	pose: YawPitchPose,
	projection: Perspective
): RenderedSegment2D[] {
	const rendered: RenderedSegment2D[] = [];

	for (const segment of segments) {
		const start = cameraSpacePointFromPose(segment[0], pose);
		const end = cameraSpacePointFromPose(segment[1], pose);
		const clipped = clipSegmentToNearPlane(start, end, projection.nearPlane);

		if (clipped == null) {
			continue;
		}

		const [visibleStart, visibleEnd] = clipped;
		const depth = (z(visibleStart) + z(visibleEnd)) / 2;

		if (depth > projection.farPlane) {
			continue;
		}

		const projectedStart = projectCameraPoint(visibleStart, projection);
		const projectedEnd = projectCameraPoint(visibleEnd, projection);
		const fade = 1 - Math.min(depth / projection.farPlane, 0.82);

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
