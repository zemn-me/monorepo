import { z } from 'zod/v4-mini';

import { Int } from '#root/ts/factorio/int.js';
import { ItemCountType } from '#root/ts/factorio/item_count_type.js';

export const InfinityFilter = z.strictObject({
	/**
	 * Name of the item prototype the filter is set to, string.
	 */
	name: z.string(),
	/**
	 * Number the filter is set to, Types/ItemCountType.
	 */
	count: z.optional(ItemCountType),
	/**
	 * Mode of the filter. Either "at-least", "at-most", or "exactly".
	 */
	mode: z.enum(['at-least', 'at-most', 'exactly']),
	index: Int,
});

export type InfinityFilter = z.infer<typeof InfinityFilter>;
