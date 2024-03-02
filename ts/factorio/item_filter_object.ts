import { z } from 'zod';

import { Int } from '#root/ts/factorio/int.js';

export const ItemFilterObject = z.object({
	/**
	 * Name of the item prototype this filter is based on.
	 */
	name: z.string(),
	/**
	 * Index of the filter, 1-based.
	 */
	index: Int,
});

export type ItemFilterObject = z.TypeOf<typeof ItemFilterObject>;
