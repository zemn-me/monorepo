import { extent, range } from 'd3-array';
import { scaleQuantize } from 'd3-scale';
import { z } from 'zod';

import { Blueprint } from '#root/ts/factorio/blueprint';
import { plot } from '#root/ts/math/canvas/braille/braille';

const T2 = z.tuple([z.number(), z.number()]);

const unrolledSpaceIndex = (width: number) => (x: number, y: number) =>
	x + y * width;
const unrolledSpaceLength = (width: number, height: number) => width * height;
/**
 * Returns a braille string representation of a Factorio
 * blueprint, suitable for basic tests on the shape of the
 * rendered gamespace.
 */
export function renderBlueprintToBrailleString(
	b: Blueprint,
	renderWidth: number,
	includeTiles: boolean = false
): string {
	const renderables = [
		...(b.entities ?? []),
		...(includeTiles ? b.tiles ?? [] : []),
	];
	const xScale = scaleQuantize(
		T2.parse(extent(renderables, v => v.position.x)),
		range(0, renderWidth + 1)
	);

	const yScale = scaleQuantize(
		T2.parse(extent(renderables, v => v.position.y)),
		xScale.range()
	);

	const width = renderWidth;
	const height = width;

	const unrolledSpace: Array<1 | 0> = Array(
		unrolledSpaceLength(width, height)
	).fill(0);
	const index = unrolledSpaceIndex(width);

	// we could probably do with a generator that takes 2D coords and maps them
	// to 1d offsets.
	for (const item of renderables) {
		unrolledSpace[index(xScale(item.position.x), yScale(item.position.y))] =
			1;
	}

	return plot(unrolledSpace, width);
}
