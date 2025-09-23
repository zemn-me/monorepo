import { z } from 'zod/v4-mini';

import { Float } from '#root/ts/factorio/float.js';

export const SpeakerParameter = z.strictObject({
	playback_volume: Float,
	playback_globally: z.boolean(),
	allow_polyphony: z.boolean(),
});

export type SpeakerParameter = z.infer<typeof SpeakerParameter>;
