import { useId } from 'react';
import type { ChartGeometry } from './chart_geometry.js';
import { radians } from './zodiac.js';

export const captionRadius = 1.335;
// Draw the type in hundredths of a ring unit before applying its 3D projection.
const radius = 100 * captionRadius;
const halfWidth = radius * Math.sin(15 * radians);
const sagitta = radius * (1 - Math.cos(15 * radians));

export function SignCaption({
	name,
	longitude,
	ring,
}: {
	name: string;
	longitude: number;
	ring: ChartGeometry['ring'];
}) {
	const id = useId();
	const center = ring(longitude, captionRadius);
	const before = ring(longitude - 1, captionRadius);
	const after = ring(longitude + 1, captionRadius);
	const outer = ring(longitude, captionRadius + 0.01);
	// The projected tangent and radius put the letters in the plane of their
	// sector. Orient the type for reading from either face of the annulus.
	const dx = after.x - before.x,
		dy = after.y - before.y;
	const direction = (Math.abs(dx) < 1e-6 ? -dy : dx) < 0 ? -1 : 1;
	const chord = 2 * radius * Math.sin(radians);
	const a = (direction * dx) / chord,
		b = (direction * dy) / chord;
	const rx = outer.x - center.x,
		ry = outer.y - center.y;
	const side = a * ry - b * rx < 0 ? -1 : 1;
	const endY = -side * sagitta;
	return (
		<g
			opacity={center.visible ? 1 : 0.5}
			transform={`matrix(${a} ${b} ${side * rx} ${side * ry} ${center.x} ${center.y})`}
		>
			<defs>
				<path
					id={id}
					d={`M${-halfWidth},${endY} A${radius},${radius} 0 0 ${side > 0 ? 0 : 1} ${halfWidth},${endY}`}
				/>
			</defs>
			<text
				textAnchor="middle"
				dominantBaseline="central"
				fill="currentColor"
				fontSize="10"
				letterSpacing=".04em"
			>
				<title>{name}</title>
				<textPath href={'#' + id} startOffset="50%">
					{name.toUpperCase()}
				</textPath>
			</text>
		</g>
	);
}
