import { z } from 'zod/v4-mini';

import { SignalID } from '#root/ts/factorio/signal_id.js';

export const SpeakerAlertParameter = z.strictObject({
	show_alert: z.boolean(),
	show_on_map: z.boolean(),
	icon_signal_id: z.optional(SignalID),
	alert_message: z.string(),
});

export type SpeakerAlertParameter = z.infer<typeof SpeakerAlertParameter>;
