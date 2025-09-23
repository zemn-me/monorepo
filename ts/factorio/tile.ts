import { z } from 'zod/v4-mini';

import { Position } from '#root/ts/factorio/position.js';

export const Tile = z.strictObject({
	/**
	 * Prototype name of the tile (e.g. "concrete")
	 */
	name: z.string(),
	position: Position,
});

export type Tile = z.infer<typeof Tile>;
