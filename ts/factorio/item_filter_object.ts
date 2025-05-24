import { z } from 'zod/v4-mini';

import { Int } from '#root/ts/factorio/int.js';

export const ItemFilterObject = z.strictObject({
	/**
	 * Name of the item prototype this filter is based on.
	 */
	name: z.string(),
	/**
	 * Index of the filter, 1-based.
	 */
	index: Int,
});

export type ItemFilterObject = z.infer<typeof ItemFilterObject>;
