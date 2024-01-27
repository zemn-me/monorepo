import { ComparatorString } from '#root/ts/factorio/comparator_string.js';
import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
import { JSONObject } from '#root/ts/json.js';

export interface CircuitCondition extends JSONObject {
	/**
	 * Specifies how inputs should be compared. If not specified, defaults to "<".
	 */
	comparator?: ComparatorString;
	first_signal?: SignalID;
	/**
	 * What to compare first_signal to. If not specified, first_signal will be compared to constant.
	 */
	second_signal?: SignalID;
	/**
	 * Constant to compare first_signal to. Has no effect when second_signal is set. When neither second_signal nor constant are specified, the effect is as though constant were specified with the value 0.
	 */
	constant?: Int;
}
