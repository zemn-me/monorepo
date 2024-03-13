import { z } from 'zod';

import { ConnectionData } from '#root/ts/factorio/connection_data.js';

export const ConnectionPoint = z.strictObject({
	red: ConnectionData.array().optional(),
	green: ConnectionData.array().optional(),
});

/**
 * Information about a single connection between two connection points.
 */
export type ConnectionPoint = z.TypeOf<typeof ConnectionPoint>;
