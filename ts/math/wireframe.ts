import { point, Point3D } from '#root/ts/math/cartesian.js';
import * as DualQuaternion from '#root/ts/math/dual_quaternion.js';
import * as Quaternion from '#root/ts/math/quaternion.js';

export type Segment3D = readonly [start: Point3D, end: Point3D];

export function box(width: number, height: number, depth: number): readonly Segment3D[] {
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const halfDepth = depth / 2;

	const corners = {
		leftBottomFront: point<3>(-halfWidth, -halfHeight, halfDepth),
		rightBottomFront: point<3>(halfWidth, -halfHeight, halfDepth),
		leftTopFront: point<3>(-halfWidth, halfHeight, halfDepth),
		rightTopFront: point<3>(halfWidth, halfHeight, halfDepth),
		leftBottomBack: point<3>(-halfWidth, -halfHeight, -halfDepth),
		rightBottomBack: point<3>(halfWidth, -halfHeight, -halfDepth),
		leftTopBack: point<3>(-halfWidth, halfHeight, -halfDepth),
		rightTopBack: point<3>(halfWidth, halfHeight, -halfDepth),
	};

	return [
		[corners.leftBottomFront, corners.rightBottomFront],
		[corners.rightBottomFront, corners.rightBottomBack],
		[corners.rightBottomBack, corners.leftBottomBack],
		[corners.leftBottomBack, corners.leftBottomFront],
		[corners.leftTopFront, corners.rightTopFront],
		[corners.rightTopFront, corners.rightTopBack],
		[corners.rightTopBack, corners.leftTopBack],
		[corners.leftTopBack, corners.leftTopFront],
		[corners.leftBottomFront, corners.leftTopFront],
		[corners.rightBottomFront, corners.rightTopFront],
		[corners.rightBottomBack, corners.rightTopBack],
		[corners.leftBottomBack, corners.leftTopBack],
	] as const;
}

export function pyramid(base: number, length: number): readonly Segment3D[] {
	const halfBase = base / 2;
	const tip = point<3>(0, 0, length);
	const nearLeft = point<3>(-halfBase, -halfBase, 0);
	const nearRight = point<3>(halfBase, -halfBase, 0);
	const farRight = point<3>(halfBase, halfBase, 0);
	const farLeft = point<3>(-halfBase, halfBase, 0);

	return [
		[nearLeft, nearRight],
		[nearRight, farRight],
		[farRight, farLeft],
		[farLeft, nearLeft],
		[nearLeft, tip],
		[nearRight, tip],
		[farRight, tip],
		[farLeft, tip],
	] as const;
}

export function rigidTransform(
	segments: readonly Segment3D[],
	rotation: Quaternion.Quaternion,
	translation: Point3D
): Segment3D[] {
	const transform = DualQuaternion.fromRotationTranslation(rotation, translation);

	return segments.map(([start, end]) => [
		DualQuaternion.transformPoint(transform, start),
		DualQuaternion.transformPoint(transform, end),
	] as const);
}
