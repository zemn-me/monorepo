import { z } from 'zod';

import { EntityNumber } from '#root/ts/factorio/entity_number';

export const ConnectionData = z.strictObject({
	entity_id: EntityNumber,
	circuit_id: z.number().optional(),
	wire_id: z.number().optional(),
});

/**
 * The actual point that a wire is connected to. Contains information about where it is connected to.
 */
export type ConnectionData = z.TypeOf<typeof ConnectionData>;
