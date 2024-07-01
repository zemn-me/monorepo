import { z } from 'zod';

import { Float } from '#root/ts/factorio/float';

export const SpeakerParameter = z.strictObject({
	playback_volume: Float,
	playback_globally: z.boolean(),
	allow_polyphony: z.boolean(),
});

export type SpeakerParameter = z.TypeOf<typeof SpeakerParameter>;
