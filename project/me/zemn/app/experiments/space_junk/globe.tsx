import { useQuery } from '@tanstack/react-query';
import { type Ref, useId, useImperativeHandle, useMemo } from 'react';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';
import { coastlineUrl } from './assets.js';
import type { Camera, PickMarker } from './chart_camera.js';
import {
	groundLocation,
	type Marker,
	surface,
	type Vector,
} from './globe_geometry.js';
import {
	globeCamera,
	globeFrame,
	globeWorld,
	height,
	width,
} from './globe_scene.js';
import { GlobeZodiac } from './globe_zodiac.js';
import { OrbitScene } from './orbit_scene.js';
import type { BodyPosition } from './planets.js';
import type { Birthplace } from './zodiac.js';

const baseWorld = globeWorld();
export function Globe({
	instant,
	bodies,
	showSigns,
	birthplace,
	markers,
	selected,
	camera,
	extent,
	pick,
}: {
	instant: number;
	bodies: BodyPosition[];
	showSigns: boolean;
	birthplace?: Birthplace & { name?: string };
	markers: Marker[];
	selected?: Marker;
	camera: Camera;
	extent: number;
	pick: Ref<PickMarker>;
}) {
	const mask = useId();
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
	// A moving outermost object must not invalidate the projection of every coastline.
	const frame = useMemo(
		() =>
			globeFrame(globeCamera(camera.turn, camera.tilt, extent), Infinity),
		[camera.turn, camera.tilt, extent]
	);
	const world = useMemo(
		() => (coastline.data ? globeWorld(coastline.data) : baseWorld),
		[coastline.data]
	);
	const projected = useMemo(() => {
		const faces: StyledFace3D[] = [];
		const hits: { x: number; y: number; marker: Marker }[] = [];
		for (const marker of markers) {
			const p = frame.project(marker);
			if (!p.visible || p.x < 0 || p.x > width || p.y < 0 || p.y > height)
				continue;
			faces.push(frame.symbol(p.center, p.depth, marker.object.kind));
			hits.push({ x: p.x, y: p.y, marker });
		}
		return { faces, hits };
	}, [markers, frame]);

	const birthPoint =
		birthplace &&
		frame.project(surface(birthplace.longitude, birthplace.latitude));
	const birthLabel = birthplace?.name
		? 'Birthplace · ' + birthplace.name
		: 'Birthplace';
	const focus = selected && frame.project(selected);
	const ground =
		location &&
		frame.project(surface(location.longitude, location.latitude));
	const focusX = focus?.x ?? 0;
	const focusY = focus?.y ?? 0;
	const labelSide = focusX > width / 2 + 65 ? -1 : 1;
	const labelOffset = focusY < 43 ? 22 : -22;
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
						world={world}
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
			{(showSigns || bodies.length > 0) && (
				<GlobeZodiac
					instant={instant}
					frame={frame}
					radius={extent * 0.9}
					bodies={bodies}
					showSigns={showSigns}
				/>
			)}
			{birthPoint?.visible && (
				<circle
					cx={birthPoint.x}
					cy={birthPoint.y}
					r="3.5"
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
					{ground?.visible && (
						<line
							x1={ground.x}
							y1={ground.y}
							x2={focus.x}
							y2={focus.y}
							stroke="currentColor"
						/>
					)}
					<g transform={`translate(${focusX} ${focusY})`}>
						<path
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
							x={labelSide * 35}
							y={labelOffset}
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
			<g transform="translate(15 362)" fill="currentColor" fontSize="9">
				<path
					d={`M0,-4v4h${scaleKm / frame.kmPerPixel}v-4`}
					stroke="currentColor"
					fill="none"
				/>
				<text y="-8">{scaleKm.toLocaleString('en-GB')} km</text>
			</g>
		</g>
	);
}
