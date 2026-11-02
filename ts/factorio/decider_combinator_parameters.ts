import { z } from 'zod';

import { ComparatorString } from '#root/ts/factorio/comparator_string.js';
import { Int } from '#root/ts/factorio/int';
import { SignalID } from '#root/ts/factorio/signal_id.js';

const CircuitNetworkFilter = z.strictObject({
	red: z.boolean(),
	green: z.boolean(),
});

const DeciderCondition = z.strictObject({
	/** Defaults to blank. */
	first_signal: SignalID.optional(),
	/**
	 * Second signal to use in an operation, if any. If this is not specified, the second
	 * argument to a decider combinator's operation is assumed to be the value of constant.
	 */
	second_signal: SignalID.optional(),
	/** Constant to use as the second argument of operation. Defaults to 0. */
	constant: Int.optional(),
	/** Specifies how the inputs should be compared. If not specified, defaults to "<". */
	comparator: ComparatorString.optional(),
	/** Which network the first signal listens to. */
	first_signal_networks: CircuitNetworkFilter.optional(),
	/** Which network the second signal listens to. */
	second_signal_networks: CircuitNetworkFilter.optional(),
	/** How this condition combines with others. */
	compare_type: z.enum(['and', 'or']).optional(),
});

const DeciderOutput = z.strictObject({
	signal: SignalID.optional(),
	copy_count_from_input: z.boolean().optional(),
	networks: CircuitNetworkFilter.optional(),
});

export const DeciderCombinatorParameters = z.strictObject({
	first_signal: SignalID.optional(),
	second_signal: SignalID.optional(),
	constant: Int.optional(),
	comparator: ComparatorString.optional(),
	output_signal: SignalID.optional(),
	copy_count_from_input: z.boolean().optional(),
	conditions: z.array(DeciderCondition).optional(),
	outputs: z.array(DeciderOutput).optional(),
});

export type DeciderCombinatorParameters = z.TypeOf<
	typeof DeciderCombinatorParameters
>;
