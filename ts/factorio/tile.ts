import { z } from 'zod';

import { Position } from '#root/ts/factorio/position.js';

export const Tile = z.object({
	/**
	 * Prototype name of the tile (e.g. "concrete")
	 */
	name: z.string(),
	position: Position,
});

export type Tile = z.TypeOf<typeof Tile>;
