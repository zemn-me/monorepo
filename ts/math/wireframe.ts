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


export function octahedron(size: number): readonly Segment3D[] {
	const half = size / 2;
	const top = point<3>(0, half, 0);
	const bottom = point<3>(0, -half, 0);
	const east = point<3>(half, 0, 0);
	const west = point<3>(-half, 0, 0);
	const north = point<3>(0, 0, half);
	const south = point<3>(0, 0, -half);

	return [
		[top, east],
		[top, west],
		[top, north],
		[top, south],
		[bottom, east],
		[bottom, west],
		[bottom, north],
		[bottom, south],
		[east, north],
		[north, west],
		[west, south],
		[south, east],
	] as const;
}

export function triangularPrism(
	base: number,
	height: number,
	depth: number
): readonly Segment3D[] {
	const halfBase = base / 2;
	const halfDepth = depth / 2;
	const halfHeight = height / 2;

	const frontApex = point<3>(0, halfHeight, halfDepth);
	const frontLeft = point<3>(-halfBase, -halfHeight, halfDepth);
	const frontRight = point<3>(halfBase, -halfHeight, halfDepth);

	const backApex = point<3>(0, halfHeight, -halfDepth);
	const backLeft = point<3>(-halfBase, -halfHeight, -halfDepth);
	const backRight = point<3>(halfBase, -halfHeight, -halfDepth);

	return [
		[frontApex, frontLeft],
		[frontLeft, frontRight],
		[frontRight, frontApex],
		[backApex, backLeft],
		[backLeft, backRight],
		[backRight, backApex],
		[frontApex, backApex],
		[frontLeft, backLeft],
		[frontRight, backRight],
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
