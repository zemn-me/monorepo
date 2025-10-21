import { z } from 'zod';

import { LogisticFilter } from '#root/ts/factorio/logistic_filter.js';
import { Uint32 } from '#root/ts/factorio/uint32.js';

export const LogisticSection = z.strictObject({
	index: Uint32,
	filters: z.array(LogisticFilter).optional(),
	group: z.string().optional(),
	active: z.boolean().optional(),
});

export type LogisticSection = z.TypeOf<typeof LogisticSection>;
