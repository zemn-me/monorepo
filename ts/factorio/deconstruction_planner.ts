import { z } from 'zod/v4-mini';

import { ItemFilterObject } from '#root/ts/factorio/item_filter_object.js';

export const DeconstructionPlanner = z.strictObject({
	settings: z.strictObject({
		entity_filter_mode: z.optional(z.number()),
		entity_filters: z.array(ItemFilterObject),
		tile_selection_mode: z.optional(z.number())
	}),
	item: z.string(),
	label: z.string(),
	version: z.number(),
});

export type DeconstructionPlanner = z.infer<typeof DeconstructionPlanner>;
