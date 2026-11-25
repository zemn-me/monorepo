import { useQuery } from '@tanstack/react-query';
import { type Ref, useId, useImperativeHandle, useMemo } from 'react';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';
import { coastlineUrl } from './assets.js';
import type { PickMarker } from './chart_camera.js';
import type { ChartGeometry } from './chart_geometry.js';
import {
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
export function Globe({
	geometry,
	placements,
	aspects,
	ascendant,
	bodies,
	showSigns,
	birthplace,
	markers,
	selected,
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
	selected?: Marker;

	pick: Ref<PickMarker>;
}) {
	const mask = useId();
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

	const birthPoint =
		unfold > 0 && birthplace
			? frame.project(surface(birthplace.longitude, birthplace.latitude))
			: undefined;
	const birthLabel = birthplace?.name
		? 'Birthplace · ' + birthplace.name
		: 'Birthplace';
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
				Zodiac marks show sky directions. The distance scale measures
				Earth and debris.
				{birthplace &&
					` The red dot marks the birthplace at ${birthplace.latitude}° latitude, ${birthplace.longitude}° longitude.`}
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
						label="Earth and orbiting debris"
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
			{unfold < 1 && (
				<WheelGuides
					geometry={geometry}
					selected={placements.find(p => p.marker === selected)}
					aspects={aspects}
					ascendant={ascendant}
				/>
			)}
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
					<title>Chart origin</title>
				</circle>
			)}
			{birthPoint?.visible && (
				<circle
					cx={birthPoint.x}
					cy={birthPoint.y}
					r={3.5 * unfold}
					fill="#cb3434"
					stroke="var(--background-color)"
					strokeWidth="1.2"
					role="img"
					aria-label={birthLabel}
				>
					<title>{birthLabel}</title>
				</circle>
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
							'Selected debris · ' + selected?.object.name
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
