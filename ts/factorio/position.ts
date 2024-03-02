import { z } from 'zod';

export const Position = z.object({
	/**
	 * X position within the blueprint, 0 is the center.
	 */
	x: z.number(),
	/**
	 * Y position within the blueprint, 0 is the center.
	 */
	y: z.number(),
});

export type Position = z.TypeOf<typeof Position>;
