import { z } from 'zod';

import { ConnectionPoint } from '#root/ts/factorio/connection_point.js';

export const Connection = z.object({
	1: ConnectionPoint,
	2: ConnectionPoint.optional(),
});

/**
 * Object containing information about the connections to other entities formed by red or green wires.
 */
export type Connection = z.TypeOf<typeof Connection>;
