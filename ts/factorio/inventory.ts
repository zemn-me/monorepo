import { z } from 'zod';

import { Int } from '#root/ts/factorio/int';
import { ItemFilterObject } from '#root/ts/factorio/item_filter_object';

export const Inventory = z.strictObject({
	filters: z.array(ItemFilterObject),
	/**
	 * The index of the first inaccessible item slot due to limiting with the red "bar". 0-based, optional. Types/ItemStackIndex.
	 */
	bar: Int.optional(),
});

export type Inventory = z.TypeOf<typeof Inventory>;
