import { point, Point3D } from '#root/ts/math/cartesian.js';
import { defaultUp } from '#root/ts/math/lookAt.js';
import { sub } from '#root/ts/math/matrix.js';
import * as Quaternion from '#root/ts/math/quaternion.js';

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
): Quaternion.Quaternion {
	const yawRotation = Quaternion.fromAxisAngle(defaultUp, yaw);
	const rightAxis = Quaternion.rotateVector(yawRotation, DEFAULT_RIGHT);
	const pitchRotation = Quaternion.fromAxisAngle(rightAxis, pitch);

	return Quaternion.normalize(
		Quaternion.multiply(pitchRotation, yawRotation)
	);
}

export function inverseOrientationFromYawPitch(
	yaw: number,
	pitch: number
): Quaternion.Quaternion {
	return Quaternion.inverse(orientationFromYawPitch(yaw, pitch));
}

export function forwardFromYawPitch(yaw: number, pitch: number): Point3D {
	return Quaternion.rotateVector(
		orientationFromYawPitch(yaw, pitch),
		DEFAULT_FORWARD
	);
}

export function forwardFromPose(
	pose: Pick<YawPitchPose, 'yaw' | 'pitch'>
): Point3D {
	return forwardFromYawPitch(pose.yaw, pose.pitch);
}

export function cameraSpacePointFromPose(
	point3d: Point3D,
	pose: YawPitchPose
): Point3D {
	return Quaternion.rotateVector(
		inverseOrientationFromYawPitch(pose.yaw, pose.pitch),
		sub<1, 3>(point3d, pose.position)
	);
}
