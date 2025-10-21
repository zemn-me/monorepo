import { z } from 'zod';

import { EntityNumber } from '#root/ts/factorio/entity_number.js';
import { ScheduleRecord } from '#root/ts/factorio/schedule_record.js';
import { WaitCondition } from '#root/ts/factorio/wait_condition.js';

const ScheduleInterruptTarget = z.strictObject({
	station: z.string(),
	wait_conditions: z.array(WaitCondition).optional(),
});

const ScheduleInterrupt = z.strictObject({
	name: z.string(),
	conditions: z.array(WaitCondition),
	targets: z.array(ScheduleInterruptTarget),
	inside_interrupt: z.boolean().optional(),
});

const SchedulePayload = z.union([
	z.array(ScheduleRecord),
	z.strictObject({
		records: z.array(ScheduleRecord),
		interrupts: z.array(ScheduleInterrupt).optional(),
	}),
]);

export const Schedule = z.strictObject({
	/**
	 * Array of #Schedule Record objects.
	 */
	schedule: SchedulePayload,
	/**
	 * Array of entity numbers of locomotives using this schedule.
	 */
	locomotives: z.array(EntityNumber),
});
