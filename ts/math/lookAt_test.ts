import { describe, expect, test } from '@jest/globals';

import { point } from '#root/ts/math/cartesian.js';
import { lookAt } from '#root/ts/math/lookAt.js';
import * as Quaternion from '#root/ts/math/quaternion.js';
import { unwrap } from '#root/ts/result/result.js';

function expectPointCloseTo(
	actual: ReturnType<typeof point<3>>,
	expected: ReturnType<typeof point<3>>,
	precision = 10
) {
	expect(actual[0]![0]!).toBeCloseTo(expected[0]![0]!, precision);
	expect(actual[1]![0]!).toBeCloseTo(expected[1]![0]!, precision);
	expect(actual[2]![0]!).toBeCloseTo(expected[2]![0]!, precision);
}

describe('lookAt', () => {
	test.each([
		['north (+z)', point<3>(0, 0, 1)],
		['south (-z)', point<3>(0, 0, -1)],
		['east (+x)', point<3>(1, 0, 0)],
		['west (-x)', point<3>(-1, 0, 0)],
	] as const)('points a pyramid tip exactly %s', (...[, direction]) => {
		const orientation = unwrap(lookAt(
			point<3>(0, 0, 0),
			direction,
			point<3>(0, 1, 0)
		));
		const pyramidTip = point<3>(0, 0, 1);

		expectPointCloseTo(
			unwrap(Quaternion.rotateVector(orientation, pyramidTip)),
			direction
		);
	});
});
