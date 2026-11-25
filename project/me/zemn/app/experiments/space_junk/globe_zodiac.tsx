import type { ChartGeometry } from './chart_geometry.js';
import { PlanetLayer } from './planet_layer.js';
import type { BodyPosition } from './planets.js';
import { SignCaption } from './sign_caption.js';
import { signs } from './zodiac.js';

export function GlobeZodiac({
	geometry,
	bodies,
	showSigns,
}: {
	geometry: ChartGeometry;
	bodies: BodyPosition[];
	showSigns: boolean;
}) {
	const { sky, unfold } = geometry;
	const project = (longitude: number, latitude: number) =>
		sky(longitude, 0.97, latitude);
	const ink = showSigns ? 1 : 1 - unfold;
	const labels =
		ink > 0
			? signs.map((name, i) => ({ name, ...sky(30 * i + 15, 1.335, -6) }))
			: [];
	// Use the globe's line-of-sight test to dash the part of the ecliptic behind Earth.
	const strokes: [string, string] = ['', ''];
	if (ink > 0) {
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
			if (unfold && longitude % 30 === 0) {
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
			{ink > 0 && (
				<g aria-label="Zodiac signs" opacity={ink}>
					<g
						fill="none"
						stroke="currentColor"
						strokeWidth={0.65 + 0.25 * unfold}
						opacity={0.4 + 0.6 * unfold}
					>
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
							compact={unfold === 1}
							project={lon => sky(lon, 1.335, -6)}
							opacity={visible ? 1 : 0.6}
						/>
					))}
				</g>
			)}
			{bodies.length > 0 && (
				<PlanetLayer
					positions={bodies}
					project={b => sky(b.longitude, 0.87, b.latitude)}
					aspectOpacity={1 - unfold}
					labelObstacles={labels}
				/>
			)}
		</g>
	);
}
