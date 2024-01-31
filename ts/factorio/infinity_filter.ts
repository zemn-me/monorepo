import { Int } from '#root/ts/factorio/int.js';
import { ItemCountType } from '#root/ts/factorio/item_count_type.js';
import { JSONObject } from '#root/ts/json.js';

export interface InfinityFilter extends JSONObject {
	/**
	 * Name of the item prototype the filter is set to, string.
	 */
	name: string;
	/**
	 * Number the filter is set to, Types/ItemCountType.
	 */
	count: ItemCountType;
	/**
	 * Mode of the filter. Either "at-least", "at-most", or "exactly".
	 */
	mode: 'at-least' | 'at-most' | 'exactly';
	index: Int;
}
