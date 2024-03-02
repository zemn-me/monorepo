import { z } from 'zod';

import { ComparatorString } from '#root/ts/factorio/comparator_string.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
import { Uint } from '#root/ts/factorio/uint.js';

export const DeciderCombinatorParameters = z.object({
	/**
	 * Defaults to blank.
	 */
	first_signal: SignalID.optional(),
	/**
	 * Second signal to use in an operation, if any. If this is not specified, the second argument to a decider combinator's operation is assumed to be the value of constant.
	 */
	second_signal: SignalID.optional(),
	/**
	 * Constant to use as the second argument of operation. Defaults to 0.
	 */
	constant: Uint.optional(),
	/**
	 * Specifies how the inputs should be compared. If not specified, defaults to "<".
	 */
	comparator: ComparatorString.optional(),
	/**
	 * Defaults to blank.
	 */
	output_signal: SignalID.optional(),
	/**
	 * Defaults to true. When false, will output a value of 1 for the given output_signal.
	 */
	copy_count_from_input: z.boolean().optional(),
});

export type DeciderCombinatorParameters = z.TypeOf<
	typeof DeciderCombinatorParameters
>;
