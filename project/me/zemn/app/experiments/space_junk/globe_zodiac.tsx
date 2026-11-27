import type { ChartGeometry } from './chart_geometry.js';
import { PlanetLayer } from './planet_layer.js';
import type { BodyPosition } from './planets.js';
import { captionRadius, SignCaption } from './sign_caption.js';
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
	const { ring, unfold } = geometry;
	const ink = showSigns ? 1 : 1 - unfold;
	const labels =
		ink > 0
			? signs.map((name, i) => ({
					name,
					longitude: 30 * i + 15,
					...ring(30 * i + 15, captionRadius),
				}))
			: [];
	const strokes: [string, string] = ['', ''];
	if (ink > 0) {
		const xy = (p: ReturnType<typeof ring>) =>
			p.x.toFixed(2) + ',' + p.y.toFixed(2);
		for (const radius of [0.97, 1.205, 1.45]) {
			let previous = ring(0, radius);
			let lastInk: number | undefined;
			for (let longitude = 2; longitude <= 360; longitude += 2) {
				const next = ring(longitude, radius);
				const i = previous.visible && next.visible ? 0 : 1;
				if (i !== lastInk) strokes[i] += 'M' + xy(previous);
				strokes[i] += 'L' + xy(next);
				lastInk = i;
				previous = next;
			}
		}
		for (let longitude = 0; longitude < 360; longitude += 5) {
			const divider = longitude % 30 === 0;
			const start = ring(longitude, divider ? 1.12 : 1.17);
			const end = ring(longitude, divider ? 1.45 : 1.205);
			strokes[start.visible && end.visible ? 0 : 1] +=
				'M' + xy(start) + 'L' + xy(end);
		}
	}
	return (
		<g>
			{ink > 0 && (
				<g aria-label="Zodiac signs" opacity={ink}>
					<g
						fill="none"
						stroke="currentColor"
						strokeWidth=".65"
						opacity=".52"
					>
						<path d={strokes[0]} />
						<path
							d={strokes[1]}
							strokeDasharray="2 3"
							opacity=".5"
						/>
					</g>
					{labels.map(({ name, longitude }) => (
						<SignCaption
							key={name}
							name={name}
							longitude={longitude}
							ring={ring}
						/>
					))}
				</g>
			)}
			{bodies.length > 0 && (
				<PlanetLayer
					positions={bodies}
					geometry={geometry}
					labelObstacles={labels}
				/>
			)}
		</g>
	);
}
