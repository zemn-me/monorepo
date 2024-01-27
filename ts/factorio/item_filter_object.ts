import { Int } from '#root/ts/factorio/int.js';

export interface ItemFilterObject {
	/**
	 * Name of the item prototype this filter is based on.
	 */
	name: string;
	/**
	 * Index of the filter, 1-based.
	 */
	index: Int;
}
