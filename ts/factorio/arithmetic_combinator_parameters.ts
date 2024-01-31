import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
import { JSONObject } from '#root/ts/json.js';

export interface ArithmeticCombinatorParameters extends JSONObject {
	/**
	 * First signal to use in an operation. If not specified, the second argument will be the value of first_constant.
	 */
	first_signal?: SignalID;

	/**
	 * Second signal to use in an operation. If not specified, the second argument will be the value of second_constant.
	 */
	second_signl?: SignalID;
	/**
	 * Constant to use as the first argument of the operation. Has no effect when first_signal is set. Defaults to 0.
	 */
	first_constant?: Int;
	/**
	 * Constant to use as the second argument of the operation. Has no effect when second_signal is set. Defaults to 0.
	 */
	second_constant?: Int;

	/**
	 * When not specified, defaults to "*".
	 */
	operation?:
		| '*'
		| '/'
		| '+'
		| '-'
		| '%'
		| '^'
		| '<<'
		| '>>'
		| 'AND'
		| 'OR'
		| 'XOR';

	/**
	 * Specifies the signal to output.
	 */
	output_signal?: SignalID;
}
