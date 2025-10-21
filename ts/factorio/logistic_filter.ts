import { z } from 'zod';

import { OneBasedIndex } from '#root/ts/factorio/base';
import { ComparatorString } from '#root/ts/factorio/comparator_string.js';
import { ItemCountType } from '#root/ts/factorio/item_count_type.js';
import { Quality } from '#root/ts/factorio/quality.js';

export const LogisticFilter = z.strictObject({
	/**
	 * Name of the item prototype this filter is set to.
	 */
	name: z.string(),
	/**
	 * Index of the filter, 1-based.
	 */
	index: OneBasedIndex,
	/**
	 * Number the filter is set to. Is 0 for storage chests.
	 */
	count: ItemCountType,
	quality: Quality.optional(),
	comparator: ComparatorString.optional(),
	max_count: ItemCountType.optional(),
});

export type LogisticFilter = z.TypeOf<typeof LogisticFilter>;
