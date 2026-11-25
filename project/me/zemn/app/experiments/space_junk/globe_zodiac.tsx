import { useMemo } from 'react';
import type { globeFrame } from './globe_scene.js';
import { PlanetLayer } from './planet_layer.js';
import { earthFixedSky, type BodyPosition } from './planets.js';
import { SignCaption } from './sign_caption.js';
import { signs } from './zodiac.js';

export function GlobeZodiac({
	instant,
	frame,
	radius,
	bodies,
	showSigns,
}: {
	instant: number;
	frame: ReturnType<typeof globeFrame>;
	radius: number;
	bodies: BodyPosition[];
	showSigns: boolean;
}) {
	const fixed = useMemo(() => earthFixedSky(new Date(instant)), [instant]);
	const project = (longitude: number, latitude: number) =>
		frame.project(fixed(longitude, latitude, radius));
	const labels = showSigns
		? signs.map((name, i) => ({ name, ...project(30 * i + 15, -6) }))
		: [];
	// Use the globe's line-of-sight test to dash the part of the ecliptic behind Earth.
	const strokes: [string, string] = ['', ''];
	if (showSigns) {
		let previousStroke: number | undefined;
		const ticks: [string, string] = ['', ''];
		const xy = (p: ReturnType<typeof project>) =>
			`${p.x.toFixed(2)},${p.y.toFixed(2)}`;
		const segment = (
			a: ReturnType<typeof project>,
			b: ReturnType<typeof project>
		) => {
			const i = a.visible && b.visible ? 0 : 1;
			if (i !== previousStroke) strokes[i] += 'M' + xy(a);
			strokes[i] += 'L' + xy(b);
			previousStroke = i;
		};
		let last = project(0, 0);
		for (let longitude = 2; longitude <= 360; longitude += 2) {
			const next = project(longitude, 0);
			segment(last, next);
			if (longitude % 30 === 0) {
				const lower = project(longitude, -1.5),
					upper = project(longitude, 1.5);
				ticks[next.visible ? 0 : 1] +=
					'M' + xy(lower) + 'L' + xy(upper);
			}
			last = next;
		}
		strokes[0] += ticks[0];
		strokes[1] += ticks[1];
	}
	return (
		<g>
			{showSigns && (
				<g aria-label="Zodiac signs">
					<g fill="none" stroke="currentColor" strokeWidth=".9">
						<path d={strokes[0]} />
						<path
							d={strokes[1]}
							strokeDasharray="2 3"
							opacity=".5"
						/>
					</g>
					{labels.map(({ name, visible }, i) => (
						<SignCaption
							key={name}
							name={name}
							start={30 * i}
							compact
							project={lon => project(lon, -6)}
							opacity={visible ? 1 : 0.6}
						/>
					))}
				</g>
			)}
			{bodies.length > 0 && (
				<PlanetLayer
					positions={bodies}
					project={b => project(b.longitude, b.latitude)}
					showAspects={false}
					labelObstacles={labels}
				/>
			)}
		</g>
	);
}
