import { useQuery } from '@tanstack/react-query';
import { type Ref, useId, useImperativeHandle, useMemo } from 'react';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';
import { coastlineUrl } from './assets.js';
import type { PickMarker } from './chart_camera.js';
import type { ChartGeometry } from './chart_geometry.js';
import {
	earthRadii,
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
import {
	type Birthplace,
	type nearestAspects,
	type Placement,
} from './zodiac.js';

import { WheelGuides } from './zodiac_wheel.js';

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

	// A slight northward lean gives the pin a profile even when looking
	// straight down at the birthplace. Altitudes are relative to local level.
	const latitude = (place.latitude * Math.PI) / 180;
	const longitude = (place.longitude * Math.PI) / 180;
	const lean = Math.tan(Math.PI / 6);
	const horizontal = Math.cos(latitude) - lean * Math.sin(latitude);
	const step = earthRadii({
		x: horizontal * Math.cos(longitude),
		y: horizontal * Math.sin(longitude),
		z: Math.sin(latitude) + lean * Math.cos(latitude),
	});
	function endpoint(altitudeKm: number) {
		const p = frame.project({
			x: anchor.x + altitudeKm * step.x,
			y: anchor.y + altitudeKm * step.y,
			z: anchor.z + altitudeKm * step.z,
		});
		// Exaggerate the symbol around its surveyed point at whole-globe zoom.
		return {
			x: point.x + 80 * (p.x - point.x),
			y: point.y + 80 * (p.y - point.y),
		};
	}
	const tip = endpoint(8),
		base = endpoint(-5);
	const label = place.name ? 'Birthplace · ' + place.name : 'Birthplace';
	return (
		<g
			role="img"
			aria-label={label}
			stroke="currentColor"
			strokeLinecap="round"
			strokeWidth={
				3.5 *
				Math.min(unfold, equatorialRadius / (30 * frame.kmPerPixel))
			}
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
	const projected = useMemo(() => {
		const faces: StyledFace3D[] = [];
		const hits: { x: number; y: number; marker: Marker }[] = [];
		let focus: ReturnType<typeof frame.project> | undefined;
		for (const [i, marker] of markers.entries()) {
			const p =
				unfold === 1
					? frame.project(marker)
					: geometry.debris(marker, placements[i]!.longitude);
			if (marker === selected) focus = p;
			if (!p.visible || p.x < 0 || p.x > width || p.y < 0 || p.y > height)
				continue;
			faces.push(
				frame.symbol(
					p.center,
					p.depth,
					marker.object.kind,
					0.58 + 0.42 * unfold
				)
			);
			hits.push({ x: p.x, y: p.y, marker });
		}
		return { faces, hits, focus };
	}, [markers, placements, selected, geometry, frame, unfold]);

	const focus = projected.focus;
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
			for (const hit of projected.hits) {
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
						label="Earth and orbiting objects"
						world={unfold ? world : undefined}
						faces={projected.faces}
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
						fontSize="11"
						fill="currentColor"
						stroke="var(--background-color)"
						strokeWidth="3"
						paintOrder="stroke"
					>
						Earth
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
