import { z } from 'zod';

import { Color } from '#root/ts/factorio/color.js';
import { Entity } from '#root/ts/factorio/entity.js';
import { Icon } from '#root/ts/factorio/icon.js';
import { Int } from '#root/ts/factorio/int.js';
import { Position } from '#root/ts/factorio/position.js';
import { Schedule } from '#root/ts/factorio/schedule.js';
import { Tile } from '#root/ts/factorio/tile.js';
import { concat } from '#root/ts/iter/index.js';
import {
	cartesianCanonicalise,
	Point2D,
	rectContaninsPoint,
} from '#root/ts/math/cartesian.js';
import { add } from '#root/ts/math/matrix.js';
import { extent } from '#root/ts/math/tuple.js';

export const Blueprint = z.object({
	/**
	 * String, the name of the item that was saved ("blueprint" in vanilla).
	 */
	item: z.string(),
	/**
	 * String, the name of the blueprint set by the user.
	 */
	label: z.string().optional(),
	/**
	 * The color of the label of this blueprint. Optional. #Color object.
	 */
	label_color: Color.optional(),
	/**
	 * The actual content of the blueprint, array of #Entity objects.
	 */
	entities: z.array(Entity).optional(),
	/**
	 * The tiles included in the blueprint, array of #Tile objects.
	 */
	tiles: z.array(Tile).optional(),
	/**
	 * The icons of the blueprint set by the user, array of #Icon objects.
	 */
	icons: z.array(Icon).optional(),
	/**
	 * The schedules for trains in this blueprint, array of #Schedule objects.
	 */
	schedules: z.array(Schedule).optional(),
	/**
	 * The description of the blueprint. Optional.
	 */
	description: z.string().optional(),
	/**
	 * The dimensions of the grid to use for snapping. Optional. #Position object.
	 */
	'snap-to-grid': Position.optional(),
	/**
	 * Whether the blueprint uses absolute or relative snapping. Optional.
	 */
	'absolute-snapping': z.boolean().optional(),
	/**
	 * Offset relative to the global absolute snapping grid. Optional. #Position object.
	 */
	'position-relative-to-grid': Position.optional(),
	/**
	 * The map version of the map the blueprint was created in.
	 */
	version: Int,
});

/**
 * Returns the minimum and maximum x and y points of a Factorio Blueprint.
 */
export function blueprintExtent(
	b: Blueprint
): [[minX: number, maxX: number], [minY: number, maxY: number]] {
	const positionable = concat(b.entities ?? [], b.tiles ?? []);

	return [
		extent(positionable, v => v.position.x),
		extent(positionable, v => v.position.y),
	];
}

/**
 * Returns two points that together represent the top left
 * and bottom right corners of a bounding box covering an
 * entire blueprint.
 */
export function blueprintBoundingBox(
	b: Blueprint
): [tl: [x: number, y: number], br: [x: number, y: number]] {
	const [[minX, maxX], [minY, maxY]] = blueprintExtent(b);

	return [
		[minX, minY],
		[maxX, maxY],
	];
}

/**
 * Returns a new Blueprint, surrounded by a wall of specified
 * depth.
 */
export function blueprintSurroundedByWall(
	b: Blueprint,
	depth: number
): Blueprint {
	const [min, max] = blueprintBoundingBox(b).map(v =>
		cartesianCanonicalise(v)
	) as [Point2D, Point2D];

	// calculate the new size of the blueprint, including the wall
	const [newMin, newMax] = [
		add(min, [[-depth], [-depth]]),
		add(max, [[depth], [depth]]),
	];

	const isInsideOriginalBoundingBox = rectContaninsPoint(min!)(max!);

	const newBlueprint = structuredClone(b);

	// iterate over the points of the new bounding box.
	// where the point would NOT be inside the old bounding box,
	// we place a wall.

	const newMinX = newMin[0]![0]!;
	const newMinY = newMin[1]![0]!;
	const newMaxX = newMax[0]![0]!;
	const newMaxY = newMax[1]![0]!;

	/**
	 * Entity number for any entites we're adding to the blueprint
	 */
	let entityNumber = (b.entities?.slice(-1)[0]?.entity_number ?? 1) + 1;

	for (let x = newMinX; x < newMaxX; x++) {
		for (let y = newMinY; y < newMaxY; y++) {
			if (!isInsideOriginalBoundingBox([[x], [y]] as Point2D))
				newBlueprint.entities = [
					...(newBlueprint.entities ?? []),
					{
						position: { x, y },
						entity_number: entityNumber++,
						name: 'stone-wall',
					},
				];
		}
	}

	newBlueprint.label = ['Walled', b.label ?? 'something or other'].join(' ');

	newBlueprint.description = [
		`Wrapped with walls of depth ${depth}.`,
		...(b.description ? [b.description] : []),
	].join('\n\n');

	return newBlueprint;
}

export type Blueprint = z.TypeOf<typeof Blueprint>;
