import { z } from 'zod';

import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';

export const Icon = z.strictObject({
	/**
	 * Index of the icon, 1-based.
	 */
	index: Int,
	/**
	 * The icon that is displayed, #SignalID object.
	 */
	signal: SignalID,
});

export type Icon = z.TypeOf<typeof Icon>;
