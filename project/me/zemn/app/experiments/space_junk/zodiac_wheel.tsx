import type { ChartGeometry } from './chart_geometry.js';
import style from './style.module.css';
import { type nearestAspects, type Placement, signPosition } from './zodiac.js';

function shortName(p: Placement) {
	const name = p.marker.object.name;
	return name.length > 24 ? 'NORAD ' + p.marker.object.id : name;
}

export function WheelGuides({
	geometry,
	aspects,
	selected,
	ascendant,
}: {
	geometry: ChartGeometry;
	aspects: ReturnType<typeof nearestAspects>;
	selected?: Placement;
	ascendant?: number;
}) {
	const at = geometry.ring;
	const anchor = ascendant ?? 0;
	const xy = (p: { x: number; y: number }) =>
		p.x.toFixed(2) + ',' + p.y.toFixed(2);
	return (
		<g opacity={1 - geometry.unfold}>
			{selected &&
				aspects.map(({ angle, name, placement }) => (
					<path
						key={name}
						d={
							'M' +
							xy(at(selected.longitude, 0.97)) +
							'L' +
							xy(at(placement.longitude, 0.97))
						}
						stroke="currentColor"
						strokeOpacity=".72"
						strokeWidth="1"
						strokeDasharray={
							angle === 60
								? '2 3'
								: angle === 120
									? '6 3'
									: undefined
						}
						fill="none"
					>
						<title>
							{name} · {placement.marker.object.name}
						</title>
					</path>
				))}
			{aspects.map(({ name, placement }) => {
				const p = at(placement.longitude, 0.97);
				return (
					<circle
						key={name}
						cx={p.x}
						cy={p.y}
						r="2"
						fill="currentColor"
					>
						<title>
							{name} · {shortName(placement)}
						</title>
					</circle>
				);
			})}
			{ascendant !== undefined && (
				<g fill="currentColor">
					<path
						d={
							'M' +
							xy(at(anchor, 1.16)) +
							'L' +
							xy(at(anchor, 0.89))
						}
						stroke="currentColor"
					/>
					<text
						x={at(anchor, 0.84).x}
						y={at(anchor, 0.84).y - 4}
						textAnchor="middle"
						fontSize="9"
					>
						ASC
					</text>
				</g>
			)}
		</g>
	);
}

export function WheelReading({
	selected,
	aspects,
}: {
	selected: Placement;
	aspects: ReturnType<typeof nearestAspects>;
}) {
	return (
		<details className={style.reading}>
			<summary>
				{shortName(selected)} · {signPosition(selected.longitude)}
			</summary>
			<p>
				{Math.abs(selected.latitude).toFixed(1)}°{' '}
				{selected.latitude < 0 ? 'below' : 'above'} the ecliptic.
			</p>
			{aspects.length > 0 && (
				<>
					<p>Closest aspects within 1°</p>
					<dl>
						{aspects.map(a => (
							<div key={a.name}>
								<dt>
									{a.name} · {a.separation.toFixed(1)}°
								</dt>
								<dd>
									{a.placement.marker.object.name} ·{' '}
									{a.placement.marker.object.id}
								</dd>
							</div>
						))}
					</dl>
				</>
			)}
		</details>
	);
}
