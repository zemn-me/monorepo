import { describe, expect, test } from '@jest/globals';

import { point } from '#root/ts/math/cartesian.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { box, pyramid, rigidTransform } from '#root/ts/math/wireframe.js';

describe('wireframe', () => {
	test('box returns the expected twelve edges', () => {
		const edges = box(4, 6, 8);

		expect(edges).toHaveLength(12);
		expect(edges).toContainEqual([point<3>(-2, -3, 4), point<3>(2, -3, 4)]);
		expect(edges).toContainEqual([point<3>(-2, 3, -4), point<3>(-2, 3, 4)]);
	});

	test('pyramid places its tip along +z', () => {
		const edges = pyramid(2, 5);

		expect(edges).toContainEqual([point<3>(-1, -1, 0), point<3>(0, 0, 5)]);
		expect(edges).toContainEqual([point<3>(1, 1, 0), point<3>(0, 0, 5)]);
	});

	test('rigidTransform rotates and translates each endpoint', () => {
		const transformed = rigidTransform(
			[[point<3>(1, 0, 0), point<3>(0, 1, 0)]],
			Quaternion.fromAxisAngle(point<3>(0, 0, 1), Math.PI / 2),
			point<3>(1, 2, 3)
		);

		expect(transformed).toHaveLength(1);
		expect(transformed[0]![0][0]![0]!).toBeCloseTo(1);
		expect(transformed[0]![0][1]![0]!).toBeCloseTo(3);
		expect(transformed[0]![0][2]![0]!).toBeCloseTo(3);
		expect(transformed[0]![1][0]![0]!).toBeCloseTo(0);
		expect(transformed[0]![1][1]![0]!).toBeCloseTo(2);
		expect(transformed[0]![1][2]![0]!).toBeCloseTo(3);
	});
});
