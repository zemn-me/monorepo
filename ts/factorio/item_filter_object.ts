import { Int } from '#root/ts/factorio/int.js';
import { JSONObject } from '#root/ts/json.js';

export interface ItemFilterObject extends JSONObject {
	/**
	 * Name of the item prototype this filter is based on.
	 */
	name: string;
	/**
	 * Index of the filter, 1-based.
	 */
	index: Int;
}
