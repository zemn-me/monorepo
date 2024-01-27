import { WaitCondition } from '#root/ts/factorio/wait_condition.js';

export interface ScheduleRecord {
	/**
	 * The name of the stop for this schedule record.
	 */
	station: string;
	/**
	 * Array of #Wait Condition objects.
	 */
	wait_conditions: WaitCondition[];
}
