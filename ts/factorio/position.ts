import { JSONObject } from '#root/ts/json.js';

export interface Position extends JSONObject {
	/**
	 * X position within the blueprint, 0 is the center.
	 */
	x: number;
	/**
	 * Y position within the blueprint, 0 is the center.
	 */
	y: number;
}
