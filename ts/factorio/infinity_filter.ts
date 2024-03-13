import { z } from 'zod';

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
	count: ItemCountType.optional(),
	/**
	 * Mode of the filter. Either "at-least", "at-most", or "exactly".
	 */
	mode: z.enum(['at-least', 'at-most', 'exactly']),
	index: Int,
});

export type InfinityFilter = z.TypeOf<typeof InfinityFilter>;
