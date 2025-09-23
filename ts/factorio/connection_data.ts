import { z } from 'zod/v4-mini';

import { EntityNumber } from '#root/ts/factorio/entity_number.js';

export const ConnectionData = z.strictObject({
	entity_id: EntityNumber,
	circuit_id: z.optional(z.number()),
	wire_id: z.optional(z.number()),
});

/**
 * The actual point that a wire is connected to. Contains information about where it is connected to.
 */
export type ConnectionData = z.infer<typeof ConnectionData>;
