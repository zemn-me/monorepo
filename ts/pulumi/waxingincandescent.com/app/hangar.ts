import { point } from '#root/ts/math/cartesian.js';
import { styleSegment } from '#root/ts/math/wireframe_render.js';
import { segments } from '#root/ts/pulumi/waxingincandescent.com/hangar/geometry.js';

/** E1M1's original proportions, uniformly scaled to the illustration's camera. */
export function hangar() {
	const xs = segments.flatMap(line => [line[0], line[3]]);
	const ys = segments.flatMap(line => [line[1], line[4]]);
	const zs = segments.flatMap(line => [line[2], line[5]]);
	const middle = (values: number[]) =>
		(Math.min(...values) + Math.max(...values)) / 2;
	const cx = middle(xs),
		cy = middle(ys),
		cz = middle(zs);
	const scale =
		44 /
		Math.max(
			Math.max(...xs) - Math.min(...xs),
			Math.max(...zs) - Math.min(...zs)
		);
	return segments.map(([x1, y1, z1, x2, y2, z2]) =>
		styleSegment(
			[
				point<3>(
					(x1 - cx) * scale,
					(y1 - cy) * scale,
					(z1 - cz) * scale
				),
				point<3>(
					(x2 - cx) * scale,
					(y2 - cy) * scale,
					(z2 - cz) * scale
				),
			],
			{ stroke: 'currentColor', width: 0.8, opacity: 0.85 }
		)
	);
}
