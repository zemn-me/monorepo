import { z } from 'zod';

export const SignalID = z.strictObject({
	type: z.union([
		z.literal('item'),
		z.literal('fluid'),
		z.literal('virtual'),
	]),
	/**
	 * Name of the item, fluid or virtual signal.
	 */
	name: z.string().optional(),
});

export type SignalID = z.TypeOf<typeof SignalID>;
