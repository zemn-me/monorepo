import { useMemo } from 'react';
import type { ChartGeometry } from './chart_geometry.js';
import { type BodyPosition, bodyAspects } from './planets.js';
import style from './style.module.css';
import { signPosition } from './zodiac.js';

interface Point {
	x: number;
	y: number;
}

export function PlanetLayer({
	positions,
	geometry,
	labelObstacles = [],
}: {
	positions: BodyPosition[];
	geometry: ChartGeometry;
	labelObstacles?: readonly Point[];
}) {
	const aspects = useMemo(() => bodyAspects(positions), [positions]);
	const occupied = [...labelObstacles];
	return (
		<g aria-label="Zodiac bodies" fill="currentColor">
			{aspects.map(({ a, b, name, angle }) => {
				const line = geometry.frame.segment(
					geometry.planet(a),
					geometry.planet(b)
				);
				if (!line) return null;
				return (
					<line
						key={a.name + b.name}
						{...line}
						stroke="currentColor"
						strokeWidth=".8"
						opacity=".55"
						strokeDasharray={
							angle === 60
								? '2 3'
								: angle === 120
									? '6 3'
									: undefined
						}
					>
						<title>{`${a.name} · ${name} · ${b.name}`}</title>
					</line>
				);
			})}
			{positions.map(body => {
				const point = geometry.planet(body);
				// Keep the dot at its exact position when glyphs coincide in projection.
				let label = { x: point.x, y: point.y - 9 };
				for (
					let i = 1;
					occupied.some(
						p => Math.hypot(label.x - p.x, label.y - p.y) < 17
					);
					i++
				) {
					const angle = i * 2.4,
						radius = 9 + 4 * Math.sqrt(i);
					label = {
						x: point.x + radius * Math.cos(angle),
						y: point.y + radius * Math.sin(angle),
					};
				}
				if (point.inFront !== false) occupied.push(label);
				return (
					<g
						key={body.name}
						display={point.inFront === false ? 'none' : undefined}
						role="img"
						opacity={point.visible === false ? 0.6 : 1}
						aria-label={
							body.name + ' · ' + signPosition(body.longitude)
						}
					>
						<title>
							{`${body.name} · ${signPosition(body.longitude)}`}
						</title>
						<line
							x1={point.x}
							y1={point.y}
							x2={label.x}
							y2={label.y}
							stroke="currentColor"
							strokeWidth=".6"
						/>
						<circle
							cx={point.x}
							cy={point.y}
							r="1.7"
							fill={
								point.visible === false
									? 'var(--background-color)'
									: 'currentColor'
							}
							stroke={
								point.visible === false
									? 'currentColor'
									: undefined
							}
							strokeWidth=".65"
						/>
						<text
							x={label.x}
							y={label.y}
							className={style.planetGlyph}
							textAnchor="middle"
							dominantBaseline="central"
						>
							{body.glyph}
							{'\uFE0E'}
						</text>
					</g>
				);
			})}
		</g>
	);
}
