import { Color } from '#root/ts/factorio/color.js';
import { Connection } from '#root/ts/factorio/connection.js';
import { ControlBehavior } from '#root/ts/factorio/control_behavior.js';
import { EntityNumber } from '#root/ts/factorio/entity_number.js';
import { Float } from '#root/ts/factorio/float.js';
import { InfinitySettings } from '#root/ts/factorio/infinty_settings.js';
import { Int } from '#root/ts/factorio/int.js';
import { Inventory } from '#root/ts/factorio/inventory.js';
import { ItemFilterObject } from '#root/ts/factorio/item_filter_object.js';
import { ItemRequestObject } from '#root/ts/factorio/item_request_object.js';
import { LogisticFilter } from '#root/ts/factorio/logistic_filter.js';
import { Position } from '#root/ts/factorio/position.js';
import { SpeakerAlertParameter } from '#root/ts/factorio/speaker_alert_parameter.js';
import { SpeakerParameter } from '#root/ts/factorio/speaker_parameter.js';
import { Tags } from '#root/ts/factorio/tags.js';
import { Uint8 } from '#root/ts/factorio/uint8.js';

export interface Entity {
	entity_number: EntityNumber;
	/**
	 * Prototype name of the entity (e.g. "offshore-pump").
	 */
	name: string;
	/**
	 * Position object, position of the entity within the blueprint.
	 */
	position: Position;
	/**
	 * Direction of the entity, uint (optional).
	 */
	direction?: number;
	/**
	 * Orientation of cargo wagon or locomotive, value 0 to 1 (optional).
	 */
	orientation?: Float;
	/**
	 * Circuit connection, object with keys starting from 1, values are #Connection objects (optional).
	 */
	connections?: Connection;
	/**
	 * Copper wire connections, array of entity_numbers (optional).
	 */
	neighbours: EntityNumber[];
	/**
	 * #Control behavior object of this entity (optional).
	 */
	control_behavior: ControlBehavior;
	/**
	 * Item requests by this entity, this is what defines the item-request-proxy when the blueprint is placed, optional. #Item request object
	 */
	items: ItemRequestObject;
	/**
	 * Name of the recipe prototype this assembling machine is set to, optional, string.
	 */
	recipe?: string;
	/**
	 * Used by Prototype/Container, optional. The index of the first inaccessible item slot due to limiting with the red "bar". 0-based Types/ItemStackIndex.
	 */
	bar: Int;
	/**
	 * Cargo wagon inventory configuration, optional. #Inventory object
	 */
	inventory: Inventory;
	/**
	 * Used by Prototype/InfinityContainer, optional. #Infinity settings object
	 */
	infinity_settings: InfinitySettings;
	/**
	 * Type of the underground belt or loader, optional. Either "input" or "output".
	 */
	type: 'input' | 'output';
	/**
	 * Input priority of the splitter, optional. Either "right" or "left", "none" is omitted.
	 */
	input_priority: 'right' | 'left';
	/**
	 * Output priority of the splitter, optional. Either "right" or "left", "none" is omitted.
	 */
	output_priority: 'right' | 'left';
	/**
	 * Filter of the splitter, optional. Name of the item prototype the filter is set to, string.
	 */
	filter: string;
	/**
	 * Filters of the filter inserter or loader, optional. Array of #Item filter objects.
	 */
	filters: ItemFilterObject;
	/**
	 * Filter mode of the filter inserter, optional. Either "whitelist" or "blacklist".
	 */
	filter_mode: 'whitelist' | 'blacklist';
	/**
	 * The stack size the inserter is set to, optional. Types/uint8.
	 */
	override_stack_size: Uint8;
	/**
	 * The drop position the inserter is set to, optional. #Position object.
	 */
	drop_position: Position;
	/**
	 * The pickup position the inserter is set to, optional. #Position object.
	 */
	pickup_position: Position;
	/**
	 * Used by Prototype/LogisticContainer, optional. #Logistic filter object.
	 */
	request_filters: LogisticFilter;
	/**
	 * Boolean. Whether this requester chest can request from buffer chests.
	 */
	request_from_buffers: boolean;
	/**
	 * Used by Programmable speaker, optional. #Speaker parameter object.
	 */
	parameters: SpeakerParameter;
	/**
	 * Used by Programmable speaker, optional. #Speaker alert parameter object
	 */
	alert_parameters: SpeakerAlertParameter;
	/**
	 * Used by the rocket silo, optional. Boolean, whether auto launch is enabled.
	 */
	auto_launch: boolean;
	/**
	 * Used by Prototype/SimpleEntityWithForce or Prototype/SimpleEntityWithOwner, optional. Types/GraphicsVariation
	 */
	variation: number;
	/**
	 * Color of the Prototype/SimpleEntityWithForce, Prototype/SimpleEntityWithOwner, or train station, optional. #Color object.
	 */
	color: Color;
	/**
	 * The name of the train station, optional.
	 */
	station: string;
	/**
	 * The manually set train limit of the train station, optional.
	 */
	manual_trains_limit: number;
	/**
	 * The current state of the power switch, optional.
	 */
	switch_state: boolean;
	/**
	 * Dictionary of arbitrary data, optional. Tags.
	 */
	tags: Tags;
}
