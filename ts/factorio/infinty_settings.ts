import { z } from 'zod/v4-mini';

import { InfinityFilter } from '#root/ts/factorio/infinity_filter.js';

export const InfinitySettings = z.strictObject({
	remove_unfiltered_items: z.optional(z.boolean()),
	filters: z.array(InfinityFilter),
});

export type InfinitySettings = z.infer<typeof InfinitySettings>;
