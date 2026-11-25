import { type Ref, useImperativeHandle, useMemo } from 'react';
import { type Camera, defaultTurn, type PickMarker } from './chart_camera.js';
import { globeCamera, globeFrame, height, width } from './globe_scene.js';
import { OrbitScene } from './orbit_scene.js';
import { PlanetLayer } from './planet_layer.js';
import type { BodyPosition } from './planets.js';
import { SignCaption } from './sign_caption.js';
import style from './style.module.css';
import {
	type nearestAspects,
	type Placement,
	radians,
	signPosition,
	signs,
} from './zodiac.js';

const band = { D: 1.025, R: 1.055, C: 1.085 };
function direction(lon: number, lat: number, r: number) {
	const a = lon * radians,
		b = lat * radians;
	return {
		x: r * Math.cos(b) * Math.cos(a),
		y: r * Math.cos(b) * Math.sin(a),
		z: r * Math.sin(b),
	};
}
function shortName(p: Placement) {
	const name = p.marker.object.name;
	return name.length > 24 ? 'NORAD ' + p.marker.object.id : name;
}

export function ZodiacWheel({
	placements,
	aspects,
	bodies,
	selected,
	ascendant,
	camera,
	pick,
}: {
	placements: Placement[];
	aspects: ReturnType<typeof nearestAspects>;
	bodies: BodyPosition[];
	selected?: Placement;
	ascendant?: number;
	camera: Camera;
	pick: Ref<PickMarker>;
}) {
	const anchor = ascendant ?? 0;
	const frame = useMemo(
		() =>
			globeFrame(
				globeCamera(
					anchor + 90 + camera.turn - defaultTurn,
					camera.tilt,
					1.41
				),
				2,
				false
			),
		[anchor, camera.turn, camera.tilt]
	);
	const at = (lon: number, r: number, lat = 0) =>
		frame.project(direction(lon, lat, r));
	const xy = (p: { x: number; y: number }) =>
		p.x.toFixed(2) + ',' + p.y.toFixed(2);
	function arc(start: number, end: number, r: number, lat = 0) {
		const steps = Math.max(1, Math.ceil(Math.abs(end - start) / 4));
		return Array.from({ length: steps + 1 }, (_, i) =>
			xy(at(start + ((end - start) * i) / steps, r, lat))
		).join('L');
	}
	const marks = useMemo(
		() =>
			placements.map(p => {
				const at = frame.project(
					direction(p.longitude, 0, band[p.marker.object.kind])
				);
				return { p, at };
			}),
		[frame, placements]
	);
	const faces = useMemo(
		() =>
			marks.map(({ p, at }) =>
				frame.symbol(at.center, at.depth, p.marker.object.kind, 0.58)
			),
		[marks, frame]
	);
	const focus = selected && marks.find(m => m.p === selected)?.at;

	useImperativeHandle(
		pick,
		() => at => {
			let nearest: Placement | undefined;
			let radius = 6;
			for (const m of marks) {
				const distance = Math.hypot(m.at.x - at.x, m.at.y - at.y);
				if (distance < radius) {
					nearest = m.p;
					radius = distance;
				}
			}
			return nearest?.marker;
		},
		[marks]
	);

	return (
		<g>
			{signs.map((sign, i) => {
				const start = i * 30,
					end = start + 30;
				return (
					<g key={sign}>
						<path
							d={
								'M' +
								arc(start, end, 1.45) +
								'L' +
								arc(end, start, 1.205) +
								'Z'
							}
							fill="none"
							stroke="currentColor"
							strokeOpacity=".52"
							strokeWidth=".65"
						/>
						<SignCaption
							name={sign}
							start={start}
							project={lon => at(lon, 1.335)}
						/>
					</g>
				);
			})}
			<path
				d={Array.from(
					{ length: 72 },
					(_, i) =>
						'M' +
						xy(at(i * 5, 1.205)) +
						'L' +
						xy(at(i * 5, i % 6 ? 1.17 : 1.12))
				).join('')}
				stroke="currentColor"
				strokeOpacity=".55"
				strokeWidth=".65"
			/>
			<path
				d={'M' + arc(0, 360, 0.97) + 'Z'}
				fill="none"
				stroke="currentColor"
				strokeOpacity=".4"
				strokeWidth=".65"
			/>
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
			<g className={style.directions}>
				<OrbitScene
					label="Debris directions"
					faces={faces}
					frame={frame}
				/>
			</g>
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
			{bodies.length > 0 && (
				<PlanetLayer
					positions={bodies}
					project={body => at(body.longitude, 0.87)}
				/>
			)}
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
			{focus && selected && (
				<g>
					<circle
						cx={focus.x}
						cy={focus.y}
						r="4"
						fill="var(--background-color)"
						stroke="currentColor"
						strokeWidth="1.7"
					/>
					<circle
						cx={focus.x}
						cy={focus.y}
						r="1.3"
						fill="currentColor"
					/>
					<text
						x={focus.x + (focus.x > width / 2 ? -9 : 9)}
						y={focus.y + (focus.y < height / 2 ? 16 : -8)}
						textAnchor={focus.x > width / 2 ? 'end' : 'start'}
						fontSize="9.5"
						fill="currentColor"
						stroke="var(--background-color)"
						strokeWidth="3"
						paintOrder="stroke"
					>
						{shortName(selected)}
					</text>
				</g>
			)}
			<circle cx={width / 2} cy={height / 2} r="2" fill="currentColor">
				<title>Chart origin</title>
			</circle>
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
