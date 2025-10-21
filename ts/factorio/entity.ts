import { z } from 'zod';

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
import { LogisticSection } from '#root/ts/factorio/logistic_section.js';
import { OneBasedIndex } from '#root/ts/factorio/base';
import { Position } from '#root/ts/factorio/position.js';
import { Quality } from '#root/ts/factorio/quality.js';
import { SpeakerAlertParameter } from '#root/ts/factorio/speaker_alert_parameter.js';
import { SpeakerParameter } from '#root/ts/factorio/speaker_parameter.js';
import { Tags } from '#root/ts/factorio/tags.js';
import { Uint8 } from '#root/ts/factorio/uint8.js';

const EntityItemInventorySlot = z.strictObject({
	/** Index of the inventory this stack lives in (Factorio 1-based). */
	inventory: Int,
	/** Slot within the inventory. */
	stack: Int,
});

const EntityItemInventoryAssignments = z.strictObject({
	/** Slot assignments for module inventories, requester inventories, etc. */
	in_inventory: z.array(EntityItemInventorySlot),
});

const EntityItemSlot = z.strictObject({
	id: z.strictObject({
		name: z.string(),
		quality: Quality.optional(),
	}),
	items: EntityItemInventoryAssignments,
});

const Something = z.strictObject({
	sections: z.array(LogisticSection),
	request_from_buffers: z.boolean().optional(),
});

const EntityPriorityListEntry = z.strictObject({
	index: OneBasedIndex,
	name: z.string(),
});

export const Entity = z.strictObject({
	entity_number: EntityNumber,
	/**
	 * Prototype name of the entity (e.g. "offshore-pump").
	 */
	name: z.string(),
	/**
	 * Position object, position of the entity within the blueprint.
	 */
	position: Position,
	/**
	 * Direction of the entity, uint (optional).
	 */
	direction: z.number().optional(),
	/**
	 * Orientation of cargo wagon or locomotive, value 0 to 1 (optional).
	 */
	orientation: Float.optional(),
	/** Mirrors building placement (Factorio 2.0). */
	mirror: z.boolean().optional(),
	/**
	 * Circuit connection, object with keys starting from 1, values are #Connection objects (optional).
	 */
	connections: Connection.optional(),
	/**
	 * Copper wire connections, array of entity_numbers (optional).
	 */
	neighbours: z.array(EntityNumber).optional(),
	/**
	 * #Control behavior object of this entity (optional).
	 */
	control_behavior: ControlBehavior.optional(),
	/**
	 * Item requests by this entity, this is what defines the item-request-proxy when the blueprint is placed, optional. #Item request object
	 */
	items:
		z.union([
			z.array(ItemRequestObject),
			ItemRequestObject,
			z.array(EntityItemSlot),
			EntityItemSlot,
		]).optional(),
	/**
	 * Name of the recipe prototype this assembling machine is set to, optional, string.
	 */
	recipe: z.string().optional(),
	/**
	 * Used by Prototype/Container, optional. The index of the first inaccessible item slot due to limiting with the red "bar". 0-based Types/ItemStackIndex.
	 */
	bar: Int.optional(),
	/**
	 * Cargo wagon inventory configuration, optional. #Inventory object
	 */
	inventory: Inventory.optional().nullable(),
	/**
	 * Used by Prototype/InfinityContainer, optional. #Infinity settings object
	 */
	infinity_settings: InfinitySettings.optional(),
	/** Pump fluid filter. */
	fluid_filter: z.string().optional(),
	/** Result inventory index for asteroid collectors. */
	'result-inventory': z.union([Int, z.null()]).optional(),
	/**
	 * Type of the underground belt or loader, optional. Either "input" or "output".
	 */
	type: z.enum(['input', 'output']).optional(),
	/**
	 * Input priority of the splitter, optional. Either "right" or "left", "none" is omitted.
	 */
	input_priority: z.enum(['right', 'left']).optional(),
	/**
	 * Output priority of the splitter, optional. Either "right" or "left", "none" is omitted.
	 */
	output_priority: z.enum(['right', 'left']).optional(),
	/**
	 * Filter of the splitter, optional. Name of the item prototype the filter is set to, string.
	 */
	filter: z.string().optional(),
	/**
	 * Filters of the filter inserter or loader, optional. Array of #Item filter objects.
	 */
	filters: z.array(ItemFilterObject).optional().nullable(),
	/**
	 * Filter mode of the filter inserter, optional. Either "whitelist" or "blacklist".
	 */
	filter_mode: z.enum(['whitelist', 'blacklist']).optional(),
	/**
	 * The stack size the inserter is set to, optional. Types/uint8.
	 */
	override_stack_size: Uint8.optional(),
	/**
	 * The drop position the inserter is set to, optional. #Position object.
	 */
	drop_position: Position.optional(),
	/**
	 * The pickup position the inserter is set to, optional. #Position object.
	 */
	pickup_position: Position.optional(),
	/**
	 * Used by Prototype/LogisticContainer, optional. #Logistic filter object.
	 */
	request_filters:
		z.union([
			Something,
			z.array(LogisticFilter),
		]).optional().nullable(),
	request_missing_construction_materials: z.boolean().optional(),
	use_filters: z.boolean().optional(),
	'priority-list': z.array(EntityPriorityListEntry).optional(),
	'ignore-unprioritised': z.boolean().optional(),
	/**
	 * Boolean. Whether this requester chest can request from buffer chests.
	 */
	request_from_buffers: z.boolean().optional(),
	/**
	 * Used by Programmable speaker, optional. #Speaker parameter object.
	 */
	parameters: SpeakerParameter.optional(),
	/**
	 * Used by Programmable speaker, optional. #Speaker alert parameter object
	 */
	alert_parameters: SpeakerAlertParameter.optional(),
	/**
	 * Used by the rocket silo, optional. Boolean, whether auto launch is enabled.
	 */
	auto_launch: z.boolean().optional(),
	/**
	 * Used by Prototype/SimpleEntityWithForce or Prototype/SimpleEntityWithOwner, optional. Types/GraphicsVariation
	 */
	variation: z.number().optional(),
	/**
	 * Color of the Prototype/SimpleEntityWithForce, Prototype/SimpleEntityWithOwner, or train station, optional. #Color object.
	 */
	color: Color.optional(),
	/**
	 * The name of the train station, optional.
	 */
	station: z.string().optional(),
	/**
	 * The manually set train limit of the train station, optional.
	 */
	manual_trains_limit: z.number().optional(),
	/**
	 * The current state of the power switch, optional.
	 */
	switch_state: z.boolean().optional(),
	/**
	 * Dictionary of arbitrary data, optional. Tags.
	 */
	tags: Tags.optional(),
	/**
	 * ?
	 */
	power_production: z.number().optional(),
	/**
	 * ?
	 */
	power_usage: z.number().optional(),
	/**
	 * ?
	 */
	buffer_size: z.number().optional(),

	recipe_quality: z.optional(Quality),
	quality: Quality.optional()
});

export type Entity = z.TypeOf<typeof Entity>;
