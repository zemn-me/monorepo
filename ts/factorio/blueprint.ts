import { Color } from '#root/ts/factorio/color.js';
import { Entity } from '#root/ts/factorio/entity.js';
import { Icon } from '#root/ts/factorio/icon.js';
import { Int } from '#root/ts/factorio/int.js';
import { Position } from '#root/ts/factorio/position.js';
import { Schedule } from '#root/ts/factorio/schedule.js';
import { Tile } from '#root/ts/factorio/tile.js';
import { JSONObject } from '#root/ts/json.js';

export interface Blueprint extends JSONObject {
	/**
	 * String, the name of the item that was saved ("blueprint" in vanilla).
	 */
	item: string;
	/**
	 * String, the name of the blueprint set by the user.
	 */
	label?: string;
	/**
	 * The color of the label of this blueprint. Optional. #Color object.
	 */
	label_color?: Color;
	/**
	 * The actual content of the blueprint, array of #Entity objects.
	 */
	entities?: Entity[];
	/**
	 * The tiles included in the blueprint, array of #Tile objects.
	 */
	tiles?: Tile[];
	/**
	 * The icons of the blueprint set by the user, array of #Icon objects.
	 */
	icons: Icon[];
	/**
	 * The schedules for trains in this blueprint, array of #Schedule objects.
	 */
	schedules?: Schedule[];
	/**
	 * The description of the blueprint. Optional.
	 */
	description?: string;
	/**
	 * The dimensions of the grid to use for snapping. Optional. #Position object.
	 */
	'snap-to-grid'?: Position;
	/**
	 * Whether the blueprint uses absolute or relative snapping. Optional.
	 */
	'absolute-snapping'?: boolean;
	/**
	 * Offset relative to the global absolute snapping grid. Optional. #Position object.
	 */
	'position-relative-to-grid'?: Position;
	/**
	 * The map version of the map the blueprint was created in.
	 */
	version: Int;
}
