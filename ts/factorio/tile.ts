import { Position } from '#root/ts/factorio/position.js';
import { JSONObject } from '#root/ts/json.js';

export interface Tile extends JSONObject {
	/**
	 * Prototype name of the tile (e.g. "concrete")
	 */
	name: string;
	position: Position;
}
