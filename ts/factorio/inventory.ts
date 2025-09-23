import { z } from 'zod/v4-mini';

import { Int } from '#root/ts/factorio/int.js';
import { ItemFilterObject } from '#root/ts/factorio/item_filter_object.js';

export const Inventory = z.strictObject({
	filters: z.array(ItemFilterObject),
	/**
	 * The index of the first inaccessible item slot due to limiting with the red "bar". 0-based, optional. Types/ItemStackIndex.
	 */
	bar: z.optional(Int),
});

export type Inventory = z.infer<typeof Inventory>;
