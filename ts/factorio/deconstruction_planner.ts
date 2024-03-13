import { z } from 'zod';

import { ItemFilterObject } from '#root/ts/factorio/item_filter_object.js';

export const DeconstructionPlanner = z.strictObject({
	settings: z.strictObject({
		entity_filter_mode: z.number().optional(),
		entity_filters: z.array(ItemFilterObject),
		tile_selection_mode: z.number().optional(),
	}),
	item: z.string(),
	label: z.string(),
	version: z.number(),
});

export type DeconstructionPlanner = z.TypeOf<typeof DeconstructionPlanner>;
