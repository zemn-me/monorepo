import { transform as cameraTransform } from '#root/ts/math/camera.js';
import { Point2D, Point3D } from '#root/ts/math/homog.js';

/**
 * Projects a 3D space onto a 2D space.
 */
export function project(focalLength: number, point: Point3D): Point2D {
	return cameraTransform(point, focalLength);
}
