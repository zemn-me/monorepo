import { z } from 'zod/v4-mini';

import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
import { Uint } from '#root/ts/factorio/uint.js';

export const ConstantCombinatorParameters = z.strictObject({
	signal: SignalID,
	count: Int,
	index: Uint,
});

export type ConstantCombinatorParameters = z.infer<
	typeof ConstantCombinatorParameters
>;
