import { z } from 'zod';

import { OneBasedIndex } from '#root/ts/factorio/base';
import { ItemCountType } from '#root/ts/factorio/item_count_type.js';

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
});

export type LogisticFilter = z.TypeOf<typeof LogisticFilter>;
