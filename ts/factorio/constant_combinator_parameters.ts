import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
import { Uint } from '#root/ts/factorio/uint.js';
import { JSONObject } from '#root/ts/json.js';

export interface ConstantCombinatorParameters extends JSONObject {
	signal: SignalID;
	count: Int;
	index: Uint;
}
