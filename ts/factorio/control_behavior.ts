import { z } from 'zod';

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
import { LogisticSection } from '#root/ts/factorio/logistic_section.js';
import { ProgrammableSpeakerCircuitParameters } from '#root/ts/factorio/programmable_speaker_circuit_parameters.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';



export const ControlBehavior = z.strictObject({
	/**
	 * CircuitCondition
	 */
	logistic_condition: CircuitCondition.optional(),
	/**
	 * Whether this entity is connected to the logistic network and enables/disables based on logistic_condition.
	 */
	connect_to_logistic_network: z.boolean().optional(),
	/**
	 * Whether this rail signal can be closed by circuit_condition.
	 */
	circuit_close_signal: z.boolean().optional(),
	/**
	 * Whether or not to read the state of this rail/chain signal.
	 */
	circuit_read_signal: z.boolean().optional(),
	/**
	 * #SignalID to use if the rail/chain signal is currently red.
	 */
	red_output_signal: SignalID.optional(),
	/**
	 * #SignalID to use if the rail/chain signal is currently orange.
	 */
	orange_output_signal: SignalID.optional(),
	/**
	 * #SignalID to use if the rail/chain signal is currently green.
	 */
	green_output_signal: SignalID.optional(),
	/**
	 * #SignalID to use if the chain signal is currently blue.
	 */
	blue_output_signal: SignalID.optional(),
	/**
	 * CircuitCondition
	 */
	circuit_condition: CircuitCondition.optional(),
	/**
	 * Whether the entity evaluates its circuit condition.
	 */
	circuit_condition_enabled: z.boolean().optional(),
	/**
	 * Whether the circuit network currently enables the entity (power-switch etc.).
	 */
	circuit_enabled: z.boolean().optional(),
	/**
	 * Sets filters via circuit network (logistic/requester chests, asteroid collectors).
	 */
	circuit_set_filters: z.boolean().optional(),
	/**
	 * Enable or disable based on circuit_condition.
	 */
	circuit_enable_disable: z.boolean().optional(),
	/**
	 * Send circuit values to the train to use in schedule conditions.
	 */
	send_to_train: z.boolean().optional(),
	/**
	 * Get the currently stopped trains cargo.
	 */
	read_from_train: z.boolean().optional(),
	/**
	 * Get the currently stopped trains ID.
	 */
	read_stopped_train: z.boolean().optional(),
	/**
	 * #SignalID to output the train ID on.
	 */
	train_stopped_signal: SignalID.optional(),
	/**
	 * Whether this stations trains limit will be set through circuit values.
	 */
	set_trains_limit: z.boolean().optional(),
	/**
	 * #SignalID to use to set the trains limit.
	 */
	trains_limit_signal: SignalID.optional(),
	/**
	 * Whether to read this stations currently on route trains count.
	 */
	read_trains_count: z.boolean().optional(),
	/**
	 * #SignalID to output the on route trains count on.
	 */
	trains_count_signal: SignalID.optional(),
	/**
	 * Whether this roboport should output the contents of its network.
	 */
	read_logistics: z.boolean().optional(),
	/**
	 * Whether this roboport should output the robot stats of its network.
	 */
	read_robot_stats: z.boolean().optional(),
	/**
	 * #SignalID to output available logistic robots on.
	 */
	available_logistic_output_signal: SignalID.optional(),
	/**
	 * #SignalID to output the total count of logistic robots on.
	 */
	total_logistic_output_signal: SignalID.optional(),
	/**
	 * #SignalID to output available construction robots on.
	 */
	available_construction_output_signal: SignalID.optional(),
	/**
	 * #SignalID to output the total count of construction robots on.
	 */
	total_construction_output_signal: SignalID.optional(),
	/**
	 * Whether to limit the gate opening with circuit_condition.
	 */
	circuit_open_gate: z.boolean().optional(),
	/**
	 * Whether to send the wall-gate proximity sensor to the circuit network.
	 */
	circuit_read_sensor: z.boolean().optional(),
	/**
	 * #SignalID to output the wall-gate sensor / accumulator charge on.
	 */
	output_signal: SignalID.optional(),
	/** Whether to read the entities temperature (heating tower). */
	read_temperature: z.boolean().optional(),
	/** Signal to report the temperature on. */
	temperature_signal: SignalID.optional(),
	/** Whether to read contents (cryogenic plant). */
	read_contents: z.boolean().optional(),
	/** Whether to report the current speed. */
	read_speed: z.boolean().optional(),
	/** Signal that receives the speed. */
	speed_signal: SignalID.optional(),
	/** Whether to report recipe completion. */
	read_recipe_finished: z.boolean().optional(),
	/** Signal that receives recipe finished events. */
	recipe_finished_signal: SignalID.optional(),
	/** Signal representing working state. */
	working_signal: SignalID.optional(),
	/** Whether to read the moving-from station (for trains). */
	read_moving_from: z.boolean().optional(),
	/** Whether the entity should set its recipe via circuit. */
	set_recipe: z.boolean().optional(),
	/** Selector combinator mode. */
	operation: z.string().optional(),
	/** Selector combinator mode: choose max instead of min. */
	select_max: z.boolean().optional(),
	/** Selector combinator index offset. */
	index_constant: Int.optional(),
	/**
	 * Whether to read this belts content or inserters hand.
	 */
	circuit_read_hand_contents: z.boolean().optional(),
	/**
	 * defines.control_behavior.transport_belt.content_read_mode
	 */
	circuit_contents_read_mode:
		DefinesControlBehaviorTransportBeltContentReadMode.optional(),
	circuit_mode_of_operation: Int.optional(),
	/**
	 * defines.control_behavior.inserter.hand_read_mode
	 */
	circuit_hand_read_mode:
		DefinesControlBehaviorInserterHandReadMode.optional(),
	/**
	 * Whether to set the inserters stack size from a circuit signal.
	 */
	circuit_set_stack_size: z.boolean().optional(),
	/**
	 * #SignalID to use to set the inserters stack size.
	 */
	stack_control_input_signal: SignalID.optional(),
	/**
	 * Whether this miner should output its remaining resource amounts to the circuit network.
	 */
	circuit_read_resources: z.boolean().optional(),
	/**
	 * defines.control_behavior.mining_drill.resource_read_mode
	 */
	circuit_resource_read_mode:
		DefinesControlBehaviorMiningDrillResourceReadMode.optional(),
	/**
	 * Whether this constant combinator is currently on or off.
	 */
	is_on: z.boolean().optional(),
	/**
	 * Array of ConstantCombinatorParameters.
	 */
	filters: z.array(ConstantCombinatorParameters).optional(),
	/**
	 * ArithmeticCombinatorParameters
	 */
	arithmetic_conditions: ArithmeticCombinatorParameters.optional(),
	/**
	 * DeciderCombinatorParameters
	 */
	decider_conditions: DeciderCombinatorParameters.optional(),
	/** Filter sections for combinators (Factorio 2.0). */
	sections: z.strictObject({
		sections: z.array(LogisticSection)
	}).optional(),
	/**
	 * ProgrammableSpeakerCircuitParameters
	 */
	circuit_parameters: ProgrammableSpeakerCircuitParameters.optional(),
	/**
	 * Whether this lamp should use colors or not.
	 */
	use_colors: z.boolean().optional(),
});

export type ControlBehavior = z.TypeOf<typeof ControlBehavior>;
