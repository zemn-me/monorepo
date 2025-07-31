import { z } from 'zod/v4-mini';

import { ConnectionData } from '#root/ts/factorio/connection_data.js';

export const ConnectionPoint = z.strictObject({
	red: z.optional(z.array(ConnectionData)),
	green: z.optional(z.array(ConnectionData)),
});

/**
 * Information about a single connection between two connection points.
 */
export type ConnectionPoint = z.infer<typeof ConnectionPoint>;
