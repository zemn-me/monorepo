import { EntityNumber } from '#root/ts/factorio/entity_number.js';
import { JSONObject } from '#root/ts/json.js';

/**
 * The actual point where a wire is connected to. Contains information about where it is connected to.
 */
export interface ConnectionData extends JSONObject {
	/**
	 * ID of the entity this connection is connected with.
	 */
	entity_id: EntityNumber;
	/**
	 * The circuit connector id of the entity this connection is connected to, see defines.circuit_connector_id.
	 */
	circuit_id: number;
}
