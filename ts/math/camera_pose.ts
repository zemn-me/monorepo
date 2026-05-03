import { point, Point3D } from '#root/ts/math/cartesian.js';
import { defaultUp } from '#root/ts/math/lookAt.js';
import { sub } from '#root/ts/math/matrix.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { and_then_flatten, type Result } from '#root/ts/result/result.js';

export interface YawPitchPose {
	readonly position: Point3D;
	readonly yaw: number;
	readonly pitch: number;
	readonly verticalVelocity?: number;
}

const DEFAULT_FORWARD = point<3>(0, 0, 1);
const DEFAULT_RIGHT = point<3>(1, 0, 0);

export function orientationFromYawPitch(
	yaw: number,
	pitch: number
): Result<Quaternion.Quaternion, Error> {
	return and_then_flatten(
		Quaternion.fromAxisAngle(defaultUp, yaw),
		yawRotation => and_then_flatten(
			Quaternion.rotateVector(yawRotation, DEFAULT_RIGHT),
			rightAxis => and_then_flatten(
				Quaternion.fromAxisAngle(rightAxis, pitch),
				pitchRotation => Quaternion.normalize(Quaternion.multiply(pitchRotation, yawRotation))
			)
		)
	);
}

export function inverseOrientationFromYawPitch(
	yaw: number,
	pitch: number
): Result<Quaternion.Quaternion, Error> {
	return and_then_flatten(
		orientationFromYawPitch(yaw, pitch),
		orientation => Quaternion.inverse(orientation)
	);
}

export function forwardFromYawPitch(
	yaw: number,
	pitch: number
): Result<Point3D, Error> {
	return and_then_flatten(
		orientationFromYawPitch(yaw, pitch),
		orientation => Quaternion.rotateVector(orientation, DEFAULT_FORWARD)
	);
}

export function forwardFromPose(
	pose: Pick<YawPitchPose, 'yaw' | 'pitch'>
): Result<Point3D, Error> {
	return forwardFromYawPitch(pose.yaw, pose.pitch);
}

export function cameraSpacePointFromPose(
	point3d: Point3D,
	pose: YawPitchPose
): Result<Point3D, Error> {
	return and_then_flatten(
		inverseOrientationFromYawPitch(pose.yaw, pose.pitch),
		orientation => Quaternion.rotateVector(orientation, sub<1, 3>(point3d, pose.position))
	);
}
