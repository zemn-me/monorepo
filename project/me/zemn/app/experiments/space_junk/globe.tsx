import { useQuery } from '@tanstack/react-query';
import { type Ref, useId, useImperativeHandle, useMemo } from 'react';
import { coastlineUrl } from './assets.js';
import type { PickMarker } from './chart_camera.js';
import type { ChartGeometry } from './chart_geometry.js';
import { objectAnchor } from './chart_query.js';
import {
	equatorialRadius,
	groundLocation,
	type Marker,
	surface,
	type Vector,
} from './globe_geometry.js';
import { globeWorld, height, width } from './globe_scene.js';
import { GlobeZodiac } from './globe_zodiac.js';
import { OrbitScene } from './orbit_scene.js';
import type { BodyPosition } from './planets.js';
import style from './style.module.css';
import {
	type Birthplace,
	type nearestAspects,
	type Placement,
} from './zodiac.js';

import { WheelGuides } from './zodiac_wheel.js';

// The billboards use screen coordinates (positive Y points down).
const markerPaths = {
	P: 'M-.9,.9 H.9 V-.9 H-.9 Z',
	D: 'M-.65,.5 H.65 L0,-.7 Z',
	R: 'M-1.1,.5 L.35,-1.15 1.1,-.5 -.35,1.15 Z',
	C: 'M-1.25,0 L0,-1.25 1.25,0 0,1.25 Z',
};
const baseWorld = globeWorld();
function BirthplacePin({
	place,
	frame,
	unfold,
}: {
	place: Birthplace & { name?: string };
	frame: ChartGeometry['frame'];
	unfold: number;
}) {
	const anchor = surface(place.longitude, place.latitude);
	const point = frame.project(anchor);
	if (!point.visible) return null;

	function endpoint(altitudeKm: number) {
		// Exaggerate the pin along the Earth–birthplace radius at whole-globe zoom.
		const radius = 1 + (80 * altitudeKm) / equatorialRadius;
		return frame.project({
			x: anchor.x * radius,
			y: anchor.y * radius,
			z: anchor.z * radius,
		});
	}
	const tip = endpoint(8),
		base = endpoint(-5);
	const dotSize =
		1.6 * Math.min(unfold, equatorialRadius / (30 * frame.kmPerPixel));
	const label = place.name ? 'Birthplace · ' + place.name : 'Birthplace';
	return (
		<g
			role="img"
			aria-label={label}
			stroke="currentColor"
			strokeLinecap="round"
			strokeWidth={dotSize}
			strokeDasharray={`0 ${2 * dotSize}`}
		>
			<title>{label}</title>
			<line
				x1={point.x}
				y1={point.y}
				x2={base.x}
				y2={base.y}
				opacity=".42"
			/>
			<line x1={point.x} y1={point.y} x2={tip.x} y2={tip.y} />
		</g>
	);
}

export function Globe({
	geometry,
	placements,
	aspects,
	ascendant,
	bodies,
	showSigns,
	birthplace,
	markers,
	selection,
	pick,
}: {
	geometry: ChartGeometry;
	placements: Placement[];
	aspects: ReturnType<typeof nearestAspects>;
	ascendant?: number;
	bodies: BodyPosition[];
	showSigns: boolean;
	birthplace?: Birthplace & { name?: string };
	markers: Marker[];
	selection?: Placement;

	pick: Ref<PickMarker>;
}) {
	const mask = useId();
	const selected = selection?.marker;
	const { frame, unfold } = geometry;
	const coastline = useQuery({
		queryKey: ['space-junk-coastline', coastlineUrl],
		staleTime: Infinity,
		meta: { persist: false },
		queryFn: async ({ signal }) => {
			const response = await fetch(coastlineUrl, { signal });
			if (!response.ok) throw new Error('Unable to load coastline');
			const data: {
				features: { geometry: { coordinates: [number, number][] } }[];
			} = await response.json();
			return data.features.map(f =>
				f.geometry.coordinates.map(([lon, lat]) => surface(lon, lat))
			);
		},
	});
	const location = selected && groundLocation(selected);
	const world = useMemo(
		() => (coastline.data ? globeWorld(coastline.data) : baseWorld),
		[coastline.data]
	);
	const projected = useMemo(
		() =>
			markers.map((marker, i) => {
				const p =
					unfold === 1
						? frame.project(marker)
						: geometry.debris(marker, placements[i]!.longitude);
				return {
					marker,
					x: p.x,
					y: p.y,
					visible: p.visible,
					inView:
						p.visible &&
						p.x >= 0 &&
						p.x <= width &&
						p.y >= 0 &&
						p.y <= height,
				};
			}),
		[markers, placements, geometry, frame, unfold]
	);

	const focus = projected.find(p => p.marker === selected);
	const ground =
		location &&
		frame.project(surface(location.longitude, location.latitude));
	const focusX = focus?.x ?? 0;
	const focusY = focus?.y ?? 0;
	const labelSide = focusX > width / 2 + 65 ? -1 : 1;
	const labelOffset = focusY < 43 ? 22 : -22;
	const textOffset =
		(1 - unfold) * (focusY < height / 2 ? 16 : -8) + unfold * labelOffset;
	const label =
		selected &&
		(selected.object.name.length <= 20
			? selected.object.name
			: `NORAD ${selected.object.id}`);
	const scaleKm = 10 ** Math.floor(Math.log10(45 * frame.kmPerPixel));
	useImperativeHandle(
		pick,
		() => at => {
			let distance = 6;
			let closest: Marker | undefined;
			for (const hit of projected) {
				if (!hit.inView) continue;
				const d = Math.hypot(at.x - hit.x, at.y - hit.y);
				if (d < distance) {
					closest = hit.marker;
					distance = d;
				}
			}
			return closest;
		},
		[projected]
	);
	return (
		<g>
			<desc>
				The zodiac ring marks sky directions. In 3D the distance scale
				applies to all bodies.
				{birthplace &&
					` The pin marks the birthplace at ${birthplace.latitude}° latitude, ${birthplace.longitude}° longitude.`}
			</desc>
			<defs>
				<mask
					id={mask}
					maskUnits="userSpaceOnUse"
					x="0"
					y="0"
					width={width}
					height={height}
				>
					<OrbitScene
						label="Earth surface"
						world={unfold ? world : undefined}
						frame={frame}
					/>
				</mask>
			</defs>
			<rect
				width={width}
				height={height}
				mask={`url(#${mask})`}
				fill="currentColor"
			/>
			<g
				aria-label="Orbiting objects"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth=".4"
				strokeLinejoin="round"
			>
				{projected.map(({ marker: { object }, x, y, inView }) => (
					<path
						key={object.id}
						id={objectAnchor(object.id)}
						role="img"
						aria-label={object.name}
						display={inView ? undefined : 'none'}
						transform={
							inView
								? `translate(${x} ${y}) scale(${0.58 + 0.42 * unfold})`
								: undefined
						}
						vectorEffect="non-scaling-stroke"
						d={markerPaths[object.kind]}
					/>
				))}
			</g>
			<WheelGuides
				geometry={geometry}
				selected={selection}
				aspects={aspects}
				ascendant={ascendant}
			/>
			<GlobeZodiac
				geometry={geometry}
				bodies={bodies}
				showSigns={showSigns}
			/>
			{unfold < 1 && (
				<circle
					cx={width / 2}
					cy={height / 2}
					r={2 * (1 - unfold)}
					fill="currentColor"
				>
					<title>Earth · chart origin</title>
				</circle>
			)}
			{unfold === 1 && frame.kmPerPixel > equatorialRadius / 4 && (
				<g
					transform={`translate(${width / 2} ${height / 2})`}
					role="img"
					aria-label="Earth"
				>
					<title>Earth</title>
					<circle r="2" fill="currentColor" />
					<path
						d="M-2,2 l-20,23 h-5"
						fill="none"
						stroke="currentColor"
						strokeWidth=".8"
					/>
					<text
						x="-30"
						y="25"
						textAnchor="end"
						dominantBaseline="central"
						className={style.planetGlyph}
					>
						⊕
					</text>
				</g>
			)}
			{unfold > 0 && birthplace && (
				<BirthplacePin
					place={birthplace}
					frame={frame}
					unfold={unfold}
				/>
			)}
			{focus?.visible && (
				<>
					{unfold > 0 && ground?.visible && (
						<line
							opacity={unfold}
							x1={ground.x}
							y1={ground.y}
							x2={focus.x}
							y2={focus.y}
							stroke="currentColor"
						/>
					)}
					<g
						role="img"
						aria-label={
							'Selected object · ' + selected?.object.name
						}
						transform={`translate(${focusX} ${focusY})`}
					>
						<path
							opacity={unfold}
							d={`M${labelSide * 4},${Math.sign(labelOffset) * 4} L${labelSide * 23},${labelOffset}h${labelSide * 9}`}
							fill="none"
							stroke="currentColor"
							strokeWidth="1.25"
						/>
						<circle
							r="5"
							fill="var(--background-color)"
							stroke="currentColor"
							strokeWidth="1.6"
						/>
						<circle r="1.7" fill="currentColor" />
						<text
							x={labelSide * (9 + 26 * unfold)}
							y={textOffset}
							textAnchor={labelSide === 1 ? 'start' : 'end'}
							dominantBaseline="middle"
							fill="currentColor"
							stroke="var(--background-color)"
							strokeWidth="3.5"
							paintOrder="stroke"
							strokeLinejoin="round"
							fontSize="11"
						>
							{label}
						</text>
					</g>
				</>
			)}
			{unfold === 1 && (
				<g
					transform="translate(15 362)"
					fill="currentColor"
					fontSize="9"
				>
					<path
						d={`M0,-4v4h${scaleKm / frame.kmPerPixel}v-4`}
						stroke="currentColor"
						fill="none"
					/>
					<text y="-8">{scaleKm.toLocaleString('en-GB')} km</text>
				</g>
			)}
		</g>
	);
}
