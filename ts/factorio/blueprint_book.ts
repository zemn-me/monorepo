import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { Color } from '#root/ts/factorio/color.js';
import { Int } from '#root/ts/factorio/int.js';

export interface BlueprintBook {
	/**
	 * String, the name of the item that was saved ("blueprint-book" in vanilla).
	 */
	item: string;
	/**
	 * String, the name of the blueprint set by the user.
	 */
	label: string;
	/**
	 * The color of the label of this blueprint. Optional. #Color object.
	 */
	label_color: Color;
	/**
	 * The actual content of the blueprint book, array of objects containing an "index" key and 0-based value and a "blueprint" key with a #Blueprint object as the value.
	 */
	blueprints: {
		/**
		 * Index, 0 based value
		 */
		index: Int;
		blueprint: Blueprint;
	}[];
	/**
	 * Index of the currently selected blueprint, 0-based.
	 */
	active_index: Int;
	/**
	 * The map version of the map the blueprint was created in, see Version string format.
	 */
	version: Int;
}
