// matrixToQuaternion.ts
import type { Matrix } from "#root/ts/math/matrix.js";
import { Quaternion } from "#root/ts/math/quaternion.js";

/**
 * Given a 4x4 matrix (assumed to be a proper rotation + translation),
 * returns the corresponding quaternion.
 */
export function matrixToQuaternion(m: Matrix<4, 4>): Quaternion {
  const m00 = m[0]![0]!, m01 = m[0]![1]!, m02 = m[0]![2]!;
  const m10 = m[1]![0]!, m11 = m[1]![1]!, m12 = m[1]![2]!;
  const m20 = m[2]![0]!, m21 = m[2]![1]!, m22 = m[2]![2]!;

  const trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    w = 0.25 / s;
    x = (m21 - m12) * s;
    y = (m02 - m20) * s;
    z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }

  return new Quaternion(x, y, z, w).normalize();
}
