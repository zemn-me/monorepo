import { Int } from '#root/ts/factorio/int.js';
import { ItemCountType } from '#root/ts/factorio/item_count_type.js';
import { JSONObject } from '#root/ts/json.js';

export interface LogisticFilter extends JSONObject {
	/**
	 * Name of the item prototype this filter is set to.
	 */
	name: string;
	/**
	 * Index of the filter, 1-based.
	 */
	index: Int;
	/**
	 * Number the filter is set to. Is 0 for storage chests.
	 */
	count: ItemCountType;
}
