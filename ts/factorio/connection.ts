import { z } from 'zod';

import { ConnectionData } from '#root/ts/factorio/connection_data.js';
import { ConnectionPoint } from '#root/ts/factorio/connection_point.js';

/**
 * The format of this object is very strange. While the docs say it's an object with keys
 * '0' and '1', in actuality it can contain 'Cu1' and 'Cu0' just the same.
 *
 * Cu1 / Cu2 appears to be used if the Connection has multiple ConnectionPoints.
 * @see https://github.com/fgardt/factorio-scanner/blob/74161d608e860c8d1a14e12f24f696a1d2fc26e3/blueprint/src/blueprint.rs#L311-L336
 */
export const Connection = z.strictObject({
	1: ConnectionPoint.optional(),
	Cu0: ConnectionData.array().optional(),
	Cu1: ConnectionData.array().optional(),
	2: ConnectionPoint.optional(),
});

/**
 * Object containing information about the connections to other entities formed by red or green wires.
 */
export type Connection = z.TypeOf<typeof Connection>;
