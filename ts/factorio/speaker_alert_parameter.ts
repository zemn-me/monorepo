import { z } from 'zod';

import { SignalID } from '#root/ts/factorio/signal_id.js';

export const SpeakerAlertParameter = z.object({
	show_alert: z.boolean(),
	show_on_map: z.boolean(),
	icon_signal_id: SignalID,
	alert_message: z.string(),
});

export type SpeakerAlertParameter = z.TypeOf<typeof SpeakerAlertParameter>;
