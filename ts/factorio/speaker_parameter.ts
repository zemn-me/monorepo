import { Float } from '#root/ts/factorio/float.js';

export interface SpeakerParameter {
	playback_volume: Float;
	playback_globally: boolean;
	allow_polyphony: boolean;
}
