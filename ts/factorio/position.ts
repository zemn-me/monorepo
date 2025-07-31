import { z } from 'zod/v4-mini';

export const Position = z.strictObject({
	/**
	 * X position within the blueprint, 0 is the center.
	 */
	x: z.number(),
	/**
	 * Y position within the blueprint, 0 is the center.
	 */
	y: z.number(),
});

export type Position = z.infer<typeof Position>;
