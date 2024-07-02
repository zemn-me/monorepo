import { z } from 'zod';

import { Int } from '#root/ts/factorio/int';
import { SignalID } from '#root/ts/factorio/signal_id';
import { Uint } from '#root/ts/factorio/uint';

export const ConstantCombinatorParameters = z.strictObject({
	signal: SignalID,
	count: Int,
	index: Uint,
});

export type ConstantCombinatorParameters = z.TypeOf<
	typeof ConstantCombinatorParameters
>;
