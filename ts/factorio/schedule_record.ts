import { z } from 'zod';

import { WaitCondition } from '#root/ts/factorio/wait_condition.js';

export const ScheduleRecord = z.strictObject({
	/**
	 * The name of the stop for this schedule record.
	 */
	station: z.string(),
	/**
	 * Array of #Wait Condition objects.
	 */
	wait_conditions: z.array(WaitCondition).optional(),
});

export type ScheduleRecord = z.TypeOf<typeof ScheduleRecord>;
