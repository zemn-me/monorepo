import { Position } from '#root/ts/factorio/position.js';

export interface Tile {
	/**
	 * Prototype name of the tile (e.g. "concrete")
	 */
	name: string;
	position: Position;
}
