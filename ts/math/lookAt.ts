// lookAtMatrix.ts
import type { Point3D } from "#root/ts/math/cartesian.js";
import { point, x, y, z } from "#root/ts/math/cartesian.js";
import type { Matrix } from "#root/ts/math/matrix.js";
import { as, cross, dot, normalise, sub } from "#root/ts/math/matrix.js";
import { matrixToQuaternion } from "#root/ts/math/matrix_to_quaternion.js";

export const defaultUp = point<3>(0, 1, 0);

export function lookAtMatrix(
  eye: Point3D,
  centre: Point3D,
  up: Point3D = defaultUp,
): Matrix<4, 4, number> {
  // Forward vector (camera facing direction)
  const forward = normalise<3>(sub<1, 3>(centre, eye));

  // Right vector
  const right = normalise<3>(cross(forward, up));

  // True up vector
  const newUp = cross(right, forward);

  // Negated dot products for translation
  const tx = -dot<3>(right, eye);
  const ty = -dot<3>(newUp, eye);
  const tz = -dot<3>(forward, eye);

  return as<4, 4, number>([
    [ x(right), x(newUp), x(forward), 0 ],
    [ y(right), y(newUp), y(forward), 0 ],
    [ z(right), z(newUp), z(forward), 0 ],
    [ tx, ty, tz, 1 ],
  ]);
}



export function lookAt(
	eye: Point3D,
	centre: Point3D,
	up: Point3D = point<3>(0, 1, 0),
) {
	return matrixToQuaternion(
		lookAtMatrix(eye, centre, up))
}
