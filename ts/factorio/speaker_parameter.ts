import { Float } from '#root/ts/factorio/float.js';
import { JSONObject } from '#root/ts/json.js';

export interface SpeakerParameter extends JSONObject {
	playback_volume: Float;
	playback_globally: boolean;
	allow_polyphony: boolean;
}
