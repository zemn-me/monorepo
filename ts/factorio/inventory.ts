import { Int } from '#root/ts/factorio/int.js';
import { ItemFilterObject } from '#root/ts/factorio/item_filter_object.js';

export interface Inventory {
	filters: ItemFilterObject;
	/**
	 * The index of the first inaccessible item slot due to limiting with the red "bar". 0-based, optional. Types/ItemStackIndex.
	 */
	bar: Int;
}
