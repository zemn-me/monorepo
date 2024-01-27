import { ConnectionData } from '#root/ts/factorio/connection_data.js';

/**
 * Information about a single connection between two connection points.
 */
export interface ConnectionPoint {
	/**
	 * An array of #Connection data object containing all the connections from this point created by red wire.
	 */
	red: ConnectionData[];
	/**
	 * An array of #Connection data object containing all the connections from this point created by green wire.
	 */
	green: ConnectionData[];
}
