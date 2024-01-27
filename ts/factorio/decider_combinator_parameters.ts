import { ComparatorString } from '#root/ts/factorio/comparator_string.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
import { Uint } from '#root/ts/factorio/uint.js';
import { JSONObject } from '#root/ts/json.js';

export interface DeciderCombinatorParameters extends JSONObject {
	/**
	 * Defaults to blank.
	 */
	first_signal?: SignalID;
	/**
	 * Second signal to use in an operation, if any. If this is not specified, the second argument to a decider combinator's operation is assumed to be the value of constant.
	 */
	second_signal?: SignalID;
	/**
	 * Constant to use as the second argument of operation. Defaults to 0.
	 */
	constant?: Uint;
	/**
	 * Specifies how the inputs should be compared. If not specified, defaults to "<".
	 */
	comparator?: ComparatorString;
	/**
	 * Defaults to blank.
	 */
	output_signal?: SignalID;
	/**
	 * Defaults to true. When false, will output a value of 1 for the given output_signal.
	 */
	copy_count_from_input?: boolean;
}
