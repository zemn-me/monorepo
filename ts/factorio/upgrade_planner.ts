import { ItemFilterObject } from "#root/ts/factorio/item_filter_object.js";
import { z } from "zod";

export const UpgradePlanner = z.strictObject({
	settings: z.strictObject({
		entity_filter_mode: z.number().optional(),
		entity_filters: z.array(ItemFilterObject).optional(),
		tile_selection_mode: z.number().optional(),
		mappers: z.strictObject({
			index: z.number(),
			from: z.strictObject({
				type: z.string(), name: z.string()
			}),

			to: z.strictObject({
				type: z.string(), name: z.string()
			})
		}).array()
	}),
	item: z.string(),
	label: z.string(),
	version: z.number(),
});

export type UpgradePlanner = z.TypeOf<typeof UpgradePlanner>
