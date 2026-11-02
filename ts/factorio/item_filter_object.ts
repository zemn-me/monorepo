import { z } from 'zod';

import { ComparatorString } from '#root/ts/factorio/comparator_string.js';
import { Int } from '#root/ts/factorio/int.js';
import { ItemCountType } from '#root/ts/factorio/item_count_type.js';
import { Quality } from '#root/ts/factorio/quality.js';

export const ItemFilterObject = z.strictObject({
	/**
	 * Name of the item prototype this filter is based on.
	 */
	name: z.string(),
	/**
	 * Index of the filter, 1-based.
	 */
	index: Int,
	count: ItemCountType.optional(),
	quality: Quality.optional(),
	comparator: ComparatorString.optional(),
});

export type ItemFilterObject = z.TypeOf<typeof ItemFilterObject>;
