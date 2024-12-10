import { describe, expect, test } from '@jest/globals';

import { point, Point3D, x, y, z } from '#root/ts/math/cartesian.js';
import { dot, normalise, sub } from '#root/ts/math/matrix.js';

import { lookAt } from './lookAt'; // Adjust path as needed

const EPSILON = 1e-6;

/**
 * Checks if two vectors are approximately equal within a given epsilon.
 */
function approxEqualVec3(a: Point3D, b: Point3D, eps = EPSILON): boolean {
  return (
    Math.abs(x(a) - x(b)) < eps &&
    Math.abs(y(a) - y(b)) < eps &&
    Math.abs(z(a) - z(b)) < eps
  );
}


describe('lookAt', () => {
  test('Rotates default-forward camera correctly', () => {
    const from = point<3>(0, 0, 0);
    const to = point<3>(1, 2, 3);
    const up = point<3>(0, 1, 0);

    const q = lookAt(from, to, up);

    // Default forward and up vectors
    const defaultForward = point<3>(0, 0, 1);
    const defaultUp = point<3>(0, 1, 0);

    // Rotate default forward and up by the quaternion
    const forwardRotated = q.rotateVector(defaultForward);
    const upRotated = q.rotateVector(defaultUp);

    // Expected directions
    const desiredForward = normalise<3>(sub<1, 3>(to, from));
    const desiredUp = normalise<3>(up);

    // Check that the rotated forward matches the desired forward
    expect(approxEqualVec3(forwardRotated, desiredForward)).toBe(true);

    // Ensure the rotated up is orthogonal to forward
    const dotFU = dot(forwardRotated, upRotated);
    expect(Math.abs(dotFU)).toBeLessThan(EPSILON);

    // Check that the rotated up matches the desired up
    expect(approxEqualVec3(upRotated, desiredUp)).toBe(true);
  });

  test('When looking directly forward, should return identity quaternion', () => {
    const from = point<3>(0, 0, 0);
    const to = point<3>(0, 0, 1); // Same as default forward
    const up = point<3>(0, 1, 0);

    const q = lookAt(from, to, up);

    // q should be close to identity (0, 0, 0, 1)
    expect(Math.abs(q.x)).toBeLessThan(EPSILON);
    expect(Math.abs(q.y)).toBeLessThan(EPSILON);
    expect(Math.abs(q.z)).toBeLessThan(EPSILON);
    expect(Math.abs(q.w - 1)).toBeLessThan(EPSILON);
  });

  test('Handles looking directly backwards', () => {
    const from = point<3>(0, 0, 0);
    const to = point<3>(0, 0, -1); // Opposite to default forward
    const up = point<3>(0, 1, 0);

    const q = lookAt(from, to, up);

    // Rotate default forward by the quaternion
    const forwardRotated = q.rotateVector(point<3>(0, 0, 1));

    // Check that it points backward
    expect(approxEqualVec3(forwardRotated, point<3>(0, 0, -1))).toBe(true);
  });
});
