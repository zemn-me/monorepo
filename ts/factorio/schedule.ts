import { z } from 'zod';

import { EntityNumber } from '#root/ts/factorio/entity_number.js';
import { ScheduleRecord } from '#root/ts/factorio/schedule_record.js';

export const Schedule = z.object({
	/**
	 * Array of #Schedule Record objects.
	 */
	schedule: z.array(ScheduleRecord),
	/**
	 * Array of entity numbers of locomotives using this schedule.
	 */
	locomotives: z.array(EntityNumber),
});
