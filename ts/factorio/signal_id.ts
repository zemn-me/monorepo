import { JSONObject } from '#root/ts/json.js';

export interface SignalID extends JSONObject {
	type: 'item' | 'fluid' | 'virtual';
	/**
	 * Name of the item, fluid or virtual signal.
	 */
	name?: string;
}
