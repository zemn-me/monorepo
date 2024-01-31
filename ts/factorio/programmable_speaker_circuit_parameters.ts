import { Uint } from '#root/ts/factorio/uint.js';
import { JSONObject } from '#root/ts/json.js';

export interface ProgrammableSpeakerCircuitParameters extends JSONObject {
	signal_value_is_pitch: boolean;
	instrument_id: Uint;
	node_id: Uint;
}
