import { z } from 'zod';

import { Int } from '#root/ts/factorio/int';
import { SignalID } from '#root/ts/factorio/signal_id';

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
