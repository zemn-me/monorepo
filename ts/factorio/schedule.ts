import { EntityNumber } from '#root/ts/factorio/entity_number.js';
import { ScheduleRecord } from '#root/ts/factorio/schedule_record.js';
import { JSONObject } from '#root/ts/json.js';

export interface Schedule extends JSONObject {
	/**
	 * Array of #Schedule Record objects.
	 */
	schedule: ScheduleRecord[];
	/**
	 * Array of entity numbers of locomotives using this schedule.
	 */
	locomotives: EntityNumber[];
}
