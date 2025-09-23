import { z } from 'zod/v4-mini';

import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';

export const ArithmeticCombinatorParameters = z.strictObject({
	/**
	 * First signal to use in an operation. If not specified, the second argument will be the value of first_constant.
	 */
	first_signal: z.optional(SignalID),

	/**
	 * Second signal to use in an operation. If not specified, the second argument will be the value of second_constant.
	 */
	second_signal: z.optional(SignalID),
	/**
	 * Constant to use as the first argument of the operation. Has no effect when first_signal is set. Defaults to 0.
	 */
	first_constant: z.optional(Int),
	/**
	 * Constant to use as the second argument of the operation. Has no effect when second_signal is set. Defaults to 0.
	 */
	second_constant: z.optional(Int),

	/**
	 * When not specified, defaults to "*".
	 */
	operation: z.union([
		z.literal('*'),
		z.literal('/'),
		z.literal('+'),
		z.literal('-'),
		z.literal('%'),
		z.literal('^'),
		z.literal('<<'),
		z.literal('>>'),
		z.literal('AND'),
		z.literal('OR'),
		z.literal('XOR'),
	]),

	/**
	 * Specifies the signal to output.
	 */
	output_signal: z.optional(SignalID),
});

export type ArithmeticCombinatorParameters = z.infer<
	typeof ArithmeticCombinatorParameters
>;
