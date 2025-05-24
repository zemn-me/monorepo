import { z } from 'zod/v4-mini';

import { Uint } from '#root/ts/factorio/uint.js';

export const ProgrammableSpeakerCircuitParameters = z.strictObject({
	signal_value_is_pitch: z.boolean(),
	instrument_id: Uint,
	note_id: Uint,
});

export type ProgrammableSpeakerCircuitParameters = z.infer<
	typeof ProgrammableSpeakerCircuitParameters
>;
