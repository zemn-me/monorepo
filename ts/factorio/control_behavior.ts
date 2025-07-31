import { z } from 'zod/v4-mini';

import { ArithmeticCombinatorParameters } from '#root/ts/factorio/arithmetic_combinator_parameters.js';
import { CircuitCondition } from '#root/ts/factorio/circuit_condition.js';
import { ConstantCombinatorParameters } from '#root/ts/factorio/constant_combinator_parameters.js';
import { DeciderCombinatorParameters } from '#root/ts/factorio/decider_combinator_parameters.js';
import {
	DefinesControlBehaviorInserterHandReadMode,
	DefinesControlBehaviorMiningDrillResourceReadMode,
	DefinesControlBehaviorTransportBeltContentReadMode,
} from '#root/ts/factorio/defines,.js';
import { Int } from '#root/ts/factorio/int.js';
import { ProgrammableSpeakerCircuitParameters } from '#root/ts/factorio/programmable_speaker_circuit_parameters.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';

export const ControlBehavior = z.strictObject({
	/** CircuitCondition */
	logistic_condition: z.optional(CircuitCondition),
	/** Whether this entity is connected to the logistic network and enables/disables based on logistic_condition. */
	connect_to_logistic_network: z.optional(z.boolean()),
	/** Whether this rail signal can be closed by circuit_condition. */
	circuit_close_signal: z.optional(z.boolean()),
	/** Whether or not to read the state of this rail/chain signal. */
	circuit_read_signal: z.optional(z.boolean()),
	/** #SignalID to use if the rail/chain signal is currently red. */
	red_output_signal: z.optional(SignalID),
	/** #SignalID to use if the rail/chain signal is currently orange. */
	orange_output_signal: z.optional(SignalID),
	/** #SignalID to use if the rail/chain signal is currently green. */
	green_output_signal: z.optional(SignalID),
	/** #SignalID to use if the chain signal is currently blue. */
	blue_output_signal: z.optional(SignalID),
	/** CircuitCondition */
	circuit_condition: z.optional(CircuitCondition),
	/** Enable or disable based on circuit_condition. */
	circuit_enable_disable: z.optional(z.boolean()),
	/** Send circuit values to the train to use in schedule conditions. */
	send_to_train: z.optional(z.boolean()),
	/** Get the currently stopped trains cargo. */
	read_from_train: z.optional(z.boolean()),
	/** Get the currently stopped trains ID. */
	read_stopped_train: z.optional(z.boolean()),
	/** #SignalID to output the train ID on. */
	train_stopped_signal: z.optional(SignalID),
	/** Whether this stations trains limit will be set through circuit values. */
	set_trains_limit: z.optional(z.boolean()),
	/** #SignalID to use to set the trains limit. */
	trains_limit_signal: z.optional(SignalID),
	/** Whether to read this stations currently on route trains count. */
	read_trains_count: z.optional(z.boolean()),
	/** #SignalID to output the on route trains count on. */
	trains_count_signal: z.optional(SignalID),
	/** Whether this roboport should output the contents of its network. */
	read_logistics: z.optional(z.boolean()),
	/** Whether this roboport should output the robot stats of its network. */
	read_robot_stats: z.optional(z.boolean()),
	/** #SignalID to output available logistic robots on. */
	available_logistic_output_signal: z.optional(SignalID),
	/** #SignalID to output the total count of logistic robots on. */
	total_logistic_output_signal: z.optional(SignalID),
	/** #SignalID to output available construction robots on. */
	available_construction_output_signal: z.optional(SignalID),
	/** #SignalID to output the total count of construction robots on. */
	total_construction_output_signal: z.optional(SignalID),
	/** Whether to limit the gate opening with circuit_condition. */
	circuit_open_gate: z.optional(z.boolean()),
	/** Whether to send the wall-gate proximity sensor to the circuit network. */
	circuit_read_sensor: z.optional(z.boolean()),
	/** #SignalID to output the wall-gate sensor / accumulator charge on. */
	output_signal: z.optional(SignalID),
	/** Whether to read this belts content or inserters hand. */
	circuit_read_hand_contents: z.optional(z.boolean()),
	/** defines.control_behavior.transport_belt.content_read_mode */
	circuit_contents_read_mode: z.optional(DefinesControlBehaviorTransportBeltContentReadMode),
	circuit_mode_of_operation: z.optional(Int),
	/** defines.control_behavior.inserter.hand_read_mode */
	circuit_hand_read_mode: z.optional(DefinesControlBehaviorInserterHandReadMode),
	/** Whether to set the inserters stack size from a circuit signal. */
	circuit_set_stack_size: z.optional(z.boolean()),
	/** #SignalID to use to set the inserters stack size. */
	stack_control_input_signal: z.optional(SignalID),
	/** Whether this miner should output its remaining resource amounts to the circuit network. */
	circuit_read_resources: z.optional(z.boolean()),
	/** defines.control_behavior.mining_drill.resource_read_mode */
	circuit_resource_read_mode: z.optional(DefinesControlBehaviorMiningDrillResourceReadMode),
	/** Whether this constant combinator is currently on or off. */
	is_on: z.optional(z.boolean()),
	/** Array of ConstantCombinatorParameters. */
	filters: z.optional(z.array(ConstantCombinatorParameters)),
	/** ArithmeticCombinatorParameters */
	arithmetic_conditions: z.optional(ArithmeticCombinatorParameters),
	/** DeciderCombinatorParameters */
	decider_conditions: z.optional(DeciderCombinatorParameters),
	/** ProgrammableSpeakerCircuitParameters */
	circuit_parameters: z.optional(ProgrammableSpeakerCircuitParameters),
	/** Whether this lamp should use colors or not. */
	use_colors: z.optional(z.boolean()),
});

export type ControlBehavior = z.infer<typeof ControlBehavior>;
