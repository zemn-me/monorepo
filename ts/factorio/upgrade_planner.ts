import { z } from "zod/v4-mini";

import { ItemFilterObject } from "#root/ts/factorio/item_filter_object.js";
import { SignalID } from "#root/ts/factorio/signal_id.js";

export const UpgradePlanner = z.strictObject({
	settings: z.strictObject({
		entity_filter_mode: z.optional(z.number()),
		entity_filters: z.optional(z.array(ItemFilterObject)),
		tile_selection_mode: z.optional(z.number()),
		icons: z.optional(z.array(z.strictObject({
			signal: SignalID,
			index: z.number()
		}))),
		mappers: z.array(z.strictObject({
			index: z.number(),
			from: z.strictObject({
				type: z.string(), name: z.string()
			}),

			to: z.strictObject({
				type: z.string(), name: z.string()
			})
		}))
	}),
	item: z.string(),
	label: z.string(),
	version: z.number(),
});

export type UpgradePlanner = z.infer<typeof UpgradePlanner>
