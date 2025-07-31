import { z } from 'zod/v4-mini';

import { WaitCondition } from '#root/ts/factorio/wait_condition.js';

export const ScheduleRecord = z.strictObject({
	/**
	 * The name of the stop for this schedule record.
	 */
	station: z.string(),
	/**
	 * Array of #Wait Condition objects.
	 */
	wait_conditions: z.optional(z.array(WaitCondition)),
});

export type ScheduleRecord = z.infer<typeof ScheduleRecord>;
