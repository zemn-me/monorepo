import { WaitCondition } from '#root/ts/factorio/wait_condition.js';
import { JSONObject } from '#root/ts/json.js';

export interface ScheduleRecord extends JSONObject {
	/**
	 * The name of the stop for this schedule record.
	 */
	station: string;
	/**
	 * Array of #Wait Condition objects.
	 */
	wait_conditions: WaitCondition[];
}
