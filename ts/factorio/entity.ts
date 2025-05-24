import { z } from 'zod/v4-mini';

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

export const Entity = z.strictObject({
	entity_number: EntityNumber,
	/** Prototype name of the entity (e.g. "offshore-pump"). */
	name: z.string(),
	/** Position object, position of the entity within the blueprint. */
	position: Position,
	/** Direction of the entity, uint (optional). */
	direction: z.optional(z.number()),
	/** Orientation of cargo wagon or locomotive, value 0 to 1 (optional). */
	orientation: z.optional(Float),
	/** Circuit connection, object with keys starting from 1, values are #Connection objects (optional). */
	connections: z.optional(Connection),
	/** Copper wire connections, array of entity_numbers (optional). */
	neighbours: z.optional(z.array(EntityNumber)),
	/** #Control behavior object of this entity (optional). */
	control_behavior: z.optional(ControlBehavior),
	/** Item requests by this entity, optional. #Item request object */
	items: z.optional(ItemRequestObject),
	/** Name of the recipe prototype, optional. */
	recipe: z.optional(z.string()),
	/** Index of the first inaccessible item slot, optional. */
	bar: z.optional(Int),
	/** Cargo wagon inventory configuration, optional. #Inventory object */
	inventory: z.nullable(z.optional(Inventory)),
	/** Used by Prototype/InfinityContainer, optional. #Infinity settings object */
	infinity_settings: z.optional(InfinitySettings),
	/** Type of the underground belt or loader, optional. */
	type: z.optional(z.enum(['input', 'output'])),
	/** Input priority of the splitter, optional. */
	input_priority: z.optional(z.enum(['right', 'left'])),
	/** Output priority of the splitter, optional. */
	output_priority: z.optional(z.enum(['right', 'left'])),
	/** Filter of the splitter, optional. */
	filter: z.optional(z.string()),
	/** Filters of the filter inserter or loader, optional. */
	filters: z.optional(z.array(ItemFilterObject)),
	/** Filter mode of the filter inserter, optional. */
	filter_mode: z.optional(z.enum(['whitelist', 'blacklist'])),
	/** Stack size the inserter is set to, optional. */
	override_stack_size: z.optional(Uint8),
	/** Drop position of the inserter, optional. */
	drop_position: z.optional(Position),
	/** Pickup position of the inserter, optional. */
	pickup_position: z.optional(Position),
	/** Used by Prototype/LogisticContainer, optional. */
	request_filters: z.optional(z.array(LogisticFilter)),
	/** Whether this requester chest can request from buffer chests. */
	request_from_buffers: z.optional(z.boolean()),
	/** Used by Programmable speaker, optional. */
	parameters: z.optional(SpeakerParameter),
	/** Used by Programmable speaker, optional. */
	alert_parameters: z.optional(SpeakerAlertParameter),
	/** Whether auto launch is enabled. */
	auto_launch: z.optional(z.boolean()),
	/** Graphics variation, optional. */
	variation: z.optional(z.number()),
	/** Color of the entity, optional. */
	color: z.optional(Color),
	/** Train station name, optional. */
	station: z.optional(z.string()),
	/** Manually set train limit, optional. */
	manual_trains_limit: z.optional(z.number()),
	/** Power switch state, optional. */
	switch_state: z.optional(z.boolean()),
	/** Arbitrary data, optional. */
	tags: z.optional(Tags),
	/** Power production, optional. */
	power_production: z.optional(z.number()),
	/** Power usage, optional. */
	power_usage: z.optional(z.number()),
	/** Buffer size, optional. */
	buffer_size: z.optional(z.number()),
});

export type Entity = z.infer<typeof Entity>;
