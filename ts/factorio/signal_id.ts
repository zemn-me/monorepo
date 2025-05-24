import { z } from 'zod/v4-mini';

export const SignalID = z.strictObject({
	type: z.union([
		z.literal('item'),
		z.literal('fluid'),
		z.literal('virtual'),
	]),
	/**
	 * Name of the item, fluid or virtual signal.
	 */
	name: z.optional(z.string()),
});

export type SignalID = z.infer<typeof SignalID>;
