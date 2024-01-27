import { Float } from '#root/ts/factorio/float.js';
import { JSONObject } from '#root/ts/json.js';

export interface Color extends JSONObject {
	/**
	 * Red, 0 to 1.
	 */
	r: Float;
	/**
	 * Green, 0 to 1.
	 */
	g: Float;
	/**
	 * Blue, 0 to 1.
	 */
	b: Float;
	/**
	 * Transparency, 0 to 1.
	 */
	a: Float;
}
