import { ConnectionPoint } from '#root/ts/factorio/connection_point.js';

/**
 * Object containing information about the connections to other entities formed by red or green wires.
 */
export interface Connection {
	/**
	 * First connection point. The default for everything that doesn't have multiple connection points.#Connection point object
	 */
	1: ConnectionPoint;
	/**
	 * Second connection point. For example, the "output" part of an arithmetic combinator.#Connection point object
	 */
	2: ConnectionPoint;
}
