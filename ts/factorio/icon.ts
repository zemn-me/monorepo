import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
import { JSONObject } from '#root/ts/json.js';

export interface Icon extends JSONObject {
	/**
	 * Index of the icon, 1-based.
	 */
	index: Int;
	/**
	 * The icon that is displayed, #SignalID object.
	 */
	signal: SignalID;
}
