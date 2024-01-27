import { Int } from '#root/ts/factorio/int.js';
import { SignalID } from '#root/ts/factorio/signal_id.js';
import { Uint } from '#root/ts/factorio/uint.js';

export interface ConstantCombinatorParameters {
	signal: SignalID;
	count: Int;
	index: Uint;
}
