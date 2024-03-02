import { z } from 'zod';

import { ComparatorString } from '#root/ts/factorio/comparator_string.js';
import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
export const CircuitCondition = z.object({
	/**
	 * Specifies how inputs should be compared. If not specified, defaults to "<".
	 */
	comparator: ComparatorString.optional(),
	first_signal: SignalID.optional(),
	/**
	 * What to compare first_signal to. If not specified, first_signal will be compared to constant.
	 */
	second_signal: SignalID.optional(),
	/**
	 * Constant to compare first_signal to. Has no effect when second_signal is set. When neither second_signal nor constant are specified, the effect is as though constant were specified with the value 0.
	 */
	constant: Int.optional(),
});

export type CircuitCondition = z.TypeOf<typeof CircuitCondition>;
