import { describe, expect, test } from '@jest/globals';

import {
	CAMERA_DRAG_RADIANS_PER_PIXEL,
	cameraAngleFromInput,
	cameraDragOffsetAfterDelta,
	PHYSICS_TICK_SECONDS,
} from '#root/project/computer/lulu/app/client.js';

describe('lulu.computer aquarium client controls', () => {
	test('adds drag rotation on top of the natural camera drift', () => {
		const offset = cameraDragOffsetAfterDelta(0.25, 120);

		expect(offset).toBeCloseTo(0.25 + 120 * CAMERA_DRAG_RADIANS_PER_PIXEL);
		expect(cameraAngleFromInput(1, offset)).toBeCloseTo(1 + offset);
		expect(
			cameraAngleFromInput(1.5, offset) - cameraAngleFromInput(1, offset)
		).toBeCloseTo(0.5);
	});

	test('uses a fixed simulation tick interval', () => {
		expect(PHYSICS_TICK_SECONDS).toBeCloseTo(1 / 60);
	});
});
