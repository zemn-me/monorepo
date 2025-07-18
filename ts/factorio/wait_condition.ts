import { z } from 'zod/v4-mini';

import { CircuitCondition } from '#root/ts/factorio/circuit_condition.js';
import { Uint } from '#root/ts/factorio/uint.js';

const WaitConditionBase = z.strictObject({
	/**
	 * Either "and", or "or". Tells how this condition is to be compared with the preceding conditions in the corresponding wait_conditions array.
	 */
	compare_type: z.enum(['and', 'or']),
});

export const WaitConditionWithCondition = z.extend(WaitConditionBase, (
	z.strictObject({
		type: z.enum(['circuit', 'fluid_count', 'item_count']),
		/**
		 * CircuitCondition object, only present when type is "item_count", "circuit" or "fluid_count".
		 */
		condition: CircuitCondition,
	})
));

export type WaitConditionWithCondition = z.infer<
	typeof WaitConditionWithCondition
>;

export const WaitConditionWithTicks = z.extend(WaitConditionBase, (
	z.strictObject({
		/**
		 * One of "time", "inactivity", "full", "empty", "item_count", "circuit", "robots_inactive", "fluid_count", "passenger_present", "passenger_not_present".
		 */
		type: z.enum([
			'time',
			'inactivity',
			'full',
			'empty',
			'item_count',
			'circuit',
			'robots_inactive',
			'fluid_count',
			'passenger_present',
			'passenger_not_present',
		]),

		/**
		 * Number of ticks to wait or of inactivity. Only present when type is "time" or "inactivity". Optional.
		 */
		ticks: Uint,
	})
));

export type WaitConditionWithTicks = z.infer<typeof WaitConditionWithTicks>;

export const WaitConditionEtc = z.extend( WaitConditionBase, (
	z.strictObject({
		/**
		 * One of "time", "inactivity", "full", "empty", "item_count", "circuit", "robots_inactive", "fluid_count", "passenger_present", "passenger_not_present".
		 */
		type: z.enum([
			'time',
			'inactivity',
			'full',
			'empty',
			'item_count',
			'circuit',
			'robots_inactive',
			'fluid_count',
			'passenger_present',
			'passenger_not_present',
		]),
	})
));

export type WaitConditionEtc = z.infer<typeof WaitConditionEtc>;

export const WaitCondition = z.union([
	WaitConditionWithTicks,
	WaitConditionWithCondition,
	WaitConditionEtc,
]);

export type WaitCondition = z.infer<typeof WaitCondition>;
