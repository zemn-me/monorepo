import { InfinityFilter } from '#root/ts/factorio/infinity_filter.js';
import { JSONObject } from '#root/ts/json.js';

export interface InfinitySettings extends JSONObject {
	remove_unfiltered_items: boolean;
	filters: InfinityFilter[];
}
