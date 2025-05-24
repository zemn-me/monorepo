import { z } from 'zod/v4-mini';

import { ComparatorString } from '#root/ts/factorio/comparator_string.js';
import { Int } from '#root/ts/factorio/int';
import { SignalID } from '#root/ts/factorio/signal_id.js';

export const DeciderCombinatorParameters = z.strictObject({
	/**
	 * Defaults to blank.
	 */
	first_signal: z.optional(SignalID),
	/**
	 * Second signal to use in an operation, if any. If this is not specified, the second argument to a decider combinator's operation is assumed to be the value of constant.
	 */
	second_signal: z.optional(SignalID),
	/**
	 * Constant to use as the second argument of operation. Defaults to 0.
	 */
	constant: z.optional(Int),
	/**
	 * Specifies how the inputs should be compared. If not specified, defaults to "<".
	 */
	comparator: z.optional(ComparatorString),
	/**
	 * Defaults to blank.
	 */
	output_signal: z.optional(SignalID),
	/**
	 * Defaults to true. When false, will output a value of 1 for the given output_signal.
	 */
	copy_count_from_input: z.optional(z.boolean()),
});

export type DeciderCombinatorParameters = z.infer<
	typeof DeciderCombinatorParameters
>;
