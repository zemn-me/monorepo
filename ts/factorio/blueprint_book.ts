import { z } from 'zod';

import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { Color } from '#root/ts/factorio/color.js';
import { DeconstructionPlanner } from '#root/ts/factorio/deconstruction_planner.js';
import { Int } from '#root/ts/factorio/int';
import { Uint } from '#root/ts/factorio/uint';

export const BlueprintBookBase = z.object({
	/**
	 * String, the name of the item that was saved ("blueprint-book" in vanilla).
	 */
	item: z.string(),
	/**
	 * String, the name of the blueprint set by the user.
	 */
	label: z.string(),
	/**
	 * The color of the label of this blueprint. Optional. #Color object.
	 */
	label_color: Color.optional(),

	/**
	 * Index of the currently selected blueprint, 0-based.
	 */
	active_index: Uint,
	/**
	 * The map version of the map the blueprint was created in, see Version string format.
	 */
	version: Int,

	description: z.string().optional(),

	icons: z.array(z.string()),
});

const optionalDeconstructionPlanner = DeconstructionPlanner.optional();
const optionalBlueprint = Blueprint.optional();

export type BlueprintBook = z.infer<typeof BlueprintBookBase> & {
	/**
	 * The actual content of the blueprint book, array of objects containing an "index" key and 0-based value and a "blueprint" key with a #Blueprint object as the value.
	 */
	blueprints: {
		index: z.infer<typeof Uint>;
		blueprint?: z.infer<typeof optionalBlueprint>;
		blueprint_book?: BlueprintBook;
		deconstruction_planner?: z.infer<typeof optionalDeconstructionPlanner>;
	}[];
};

export const BlueprintBook: z.ZodType<BlueprintBook> = BlueprintBookBase.extend(
	{
		blueprints: z.array(
			z.object({
				/**
				 * Index, 0 based value
				 */
				index: Uint,
				blueprint: optionalBlueprint,
				blueprint_book: z.lazy(() => BlueprintBook).optional(),
				deconstruction_planner: DeconstructionPlanner.optional(),
			})
		),
	}
);
