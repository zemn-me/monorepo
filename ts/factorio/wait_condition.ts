import { CircuitCondition } from '#root/ts/factorio/circuit_condition.js';
import { Uint } from '#root/ts/factorio/uint.js';
import { JSONObject } from '#root/ts/json.js';

export interface WaitCondition extends JSONObject {
	/**
	 * One of "time", "inactivity", "full", "empty", "item_count", "circuit", "robots_inactive", "fluid_count", "passenger_present", "passenger_not_present".
	 */
	type:
		| 'time'
		| 'inactivity'
		| 'full'
		| 'empty'
		| 'item_count'
		| 'circuit'
		| 'robots_inactive'
		| 'fluid_count'
		| 'passenger_present'
		| 'passenger_not_present';
	/**
	 * Either "and", or "or". Tells how this condition is to be compared with the preceding conditions in the corresponding wait_conditions array.
	 */
	compare_type: 'and' | 'or';
	/**
	 * Number of ticks to wait or of inactivity. Only present when type is "time" or "inactivity". Optional.
	 */
	ticks: Uint;
	/**
	 * CircuitCondition object, only present when type is "item_count", "circuit" or "fluid_count".
	 */
	condition: CircuitCondition;
}
