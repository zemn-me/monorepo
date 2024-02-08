import { ItemFilterObject } from '#root/ts/factorio/item_filter_object.js';
import { JSONObject } from '#root/ts/json.js';

export interface DeconstructionPlanner extends JSONObject {
	settings: {
		entity_filter_mode?: number;
		entity_filters: ItemFilterObject[];
		tile_selection_mode?: number;
	};
	item: string;
	label: string;
	version: number;
}
