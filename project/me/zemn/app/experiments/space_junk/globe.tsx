import { useQuery } from '@tanstack/react-query';
import { useId, useMemo, useRef, useState } from 'react';

import { coastlineUrl } from './assets.js';
import {
	camera,
	groundLocation,
	type Marker,
	surface,
	type Vector,
} from './globe_geometry.js';
import style from './style.module.css';

const grid: Vector[][] = [];
for (let lat = -60; lat <= 60; lat += 30)
	grid.push(Array.from({ length: 181 }, (_, j) => surface(j * 2, lat)));
for (let lon = 0; lon < 360; lon += 30)
	grid.push(Array.from({ length: 91 }, (_, j) => surface(lon, j * 2 - 90)));

const colors = { D: '#8dc7bf', R: '#f2ca84', C: '#f5e6d1' };
const empty: Marker[] = [];
const initialView = { turn: 12, tilt: 24 };
const clamp = (n: number, min: number, max: number) =>
	Math.max(min, Math.min(max, n));
const wrap = (n: number) => ((((n + 180) % 360) + 360) % 360) - 180;
const size = (p: Vector) => Math.hypot(p.x, p.y, p.z);

function visibleLines(
	lines: Vector[][],
	project: ReturnType<typeof camera>,
	radius: number
) {
	let path = '';
	for (const line of lines) {
		let drawing = false;
		for (const p of line) {
			const point = project(p);
			if (point.depth >= 0) {
				path +=
					(drawing ? 'L' : 'M') +
					(point.x * radius).toFixed(1) +
					',' +
					(point.y * radius).toFixed(1);
			}
			drawing = point.depth >= 0;
		}
	}
	return path;
}

export function Globe({
	markers = empty,
	selected,
	onSelect,
}: {
	markers?: Marker[];
	selected?: Marker;
	onSelect?: (marker: Marker) => void;
}) {
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
	const startingView = location
		? { turn: wrap(location.longitude - 24), tilt: location.latitude * 0.8 }
		: initialView;
	const maxExtent = useMemo(
		() => markers.reduce((m, p) => Math.max(m, size(p) * 1.05), 2),
		[markers]
	);
	const closeExtent = 1.5;
	const initialExtent = selected
		? Math.max(closeExtent, size(selected) * 0.65)
		: closeExtent;
	const [view, setView] = useState(startingView);
	const [extent, setExtent] = useState(initialExtent);
	const radius = 184 / extent;
	const project = useMemo(() => camera(view.turn, view.tilt), [view]);
	const gradient = useId();
	const drag = useRef<{
		id: number;
		x: number;
		y: number;
		turn: number;
		tilt: number;
		moved: boolean;
	} | null>(null);
	const projected = useMemo(() => {
		const paths = { D: '', R: '', C: '' };
		const hits: { x: number; y: number; marker: Marker }[] = [];
		for (const marker of markers) {
			const p = project(marker);
			if (!p.visible) continue;
			const x = p.x * radius;
			const y = p.y * radius;
			if (Math.abs(x) > 207 || Math.abs(y) > 187) continue;
			const kind = marker.object.kind;
			// One SVG path per class keeps rotation responsive with large catalogues.
			const start = 'M' + x.toFixed(1) + ',' + y.toFixed(1);
			paths[kind] +=
				start +
				(kind === 'D' ? 'h.01' : kind === 'R' ? 'l.7,-.8' : 'l.9,.9');
			hits.push({ x, y, marker });
		}
		return { paths, hits };
	}, [markers, project, radius]);
	const gridPath = useMemo(
		() => visibleLines(grid, project, radius),
		[project, radius]
	);
	const coastPath = useMemo(
		() => visibleLines(coastline.data ?? [], project, radius),
		[coastline.data, project, radius]
	);
	const focus = selected && project(selected);
	const ground =
		location && project(surface(location.longitude, location.latitude));
	const focusX = (focus?.x ?? 0) * radius;
	const focusY = (focus?.y ?? 0) * radius;
	const labelSide = focusX > 65 ? -1 : 1;
	const labelOffset = focusY < -145 ? 22 : -22;
	const label =
		selected &&
		(selected.object.name.length <= 20
			? selected.object.name
			: `NORAD ${selected.object.id}`);
	const scaleKm = 10 ** Math.floor(Math.log10((45 * 6378.137) / radius));
	return (
		<div className={style.viewer}>
			<svg
				id="orbital-globe"
				tabIndex={-1}
				className={style.globe}
				viewBox="-208 -188 416 376"
				role="img"
				aria-label="Earth and debris at their estimated orbital positions. Drag to rotate or use the view controls."
				onPointerDown={e => {
					if (!e.isPrimary || e.button !== 0) return;
					drag.current = {
						id: e.pointerId,
						x: e.clientX,
						y: e.clientY,
						...view,
						moved: false,
					};
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={e => {
					const start = drag.current;
					if (!start || start.id !== e.pointerId) return;
					const dx = e.clientX - start.x,
						dy = e.clientY - start.y;
					if (!start.moved && Math.hypot(dx, dy) < 3) return;
					start.moved = true;
					const scale =
						220 / e.currentTarget.getBoundingClientRect().width;
					setView({
						turn: wrap(start.turn - dx * scale),
						tilt: clamp(start.tilt + dy * scale, -90, 90),
					});
				}}
				onPointerUp={e => {
					const start = drag.current;
					if (
						!onSelect ||
						!start ||
						start.id !== e.pointerId ||
						start.moved
					)
						return;
					const transform = e.currentTarget.getScreenCTM();
					if (!transform) return;
					const at = new DOMPoint(
						e.clientX,
						e.clientY
					).matrixTransform(transform.inverse());
					let distance = 6;
					let closest: Marker | undefined;
					for (const hit of projected.hits) {
						const d = Math.hypot(at.x - hit.x, at.y - hit.y);
						if (d < distance) {
							closest = hit.marker;
							distance = d;
						}
					}
					if (closest) onSelect(closest);
				}}
				onLostPointerCapture={() => {
					drag.current = null;
				}}
			>
				<defs>
					<radialGradient id={gradient} cx="36%" cy="30%" r="76%">
						<stop offset="0" stopColor="#456b70" />
						<stop offset=".76" stopColor="#294858" />
						<stop offset="1" stopColor="#192f42" />
					</radialGradient>
				</defs>
				<circle
					r={radius}
					fill={`url(#${gradient})`}
					stroke="#73959b"
					strokeWidth=".9"
				/>
				<path
					aria-label="Latitude and longitude grid"
					d={gridPath}
					fill="none"
					stroke="#8bafb0"
					strokeWidth=".55"
					opacity=".50"
				/>
				<path
					aria-label="Coastlines"
					d={coastPath}
					fill="none"
					stroke="#c1d5bb"
					strokeWidth="1"
					strokeLinejoin="round"
				/>
				{(['D', 'R', 'C'] as const).map(kind => (
					<path
						key={kind}
						d={projected.paths[kind]}
						fill="none"
						stroke={colors[kind]}
						strokeOpacity={kind === 'D' ? 0.63 : 0.88}
						strokeWidth={kind === 'D' ? 1.5 : 1.7}
						strokeLinecap="round"
					/>
				))}
				{focus?.visible && (
					<>
						{ground && ground.depth >= 0 && (
							<line
								x1={ground.x * radius}
								y1={ground.y * radius}
								x2={focus.x * radius}
								y2={focus.y * radius}
								stroke="#fff1bb"
							/>
						)}
						<g transform={`translate(${focusX} ${focusY})`}>
							<path
								d={`M${labelSide * 4},${Math.sign(labelOffset) * 4} L${labelSide * 23},${labelOffset}h${labelSide * 9}`}
								fill="none"
								stroke="#ffd484"
								strokeWidth="1.25"
							/>
							<circle
								r="5"
								fill="#18273b"
								stroke="#ffd484"
								strokeWidth="1.6"
							/>
							<circle r="1.7" fill="#ffd484" />
							<text
								x={labelSide * 35}
								y={labelOffset}
								textAnchor={labelSide === 1 ? 'start' : 'end'}
								dominantBaseline="middle"
								fill="#ffe5ad"
								stroke="#18273b"
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
				<g transform="translate(-193 174)" fill="#d5d8cd" fontSize="9">
					<path
						d={`M0,-4v4h${(radius * scaleKm) / 6378.137}v-4`}
						stroke="currentColor"
						fill="none"
					/>
					<text y="-8">{scaleKm.toLocaleString('en-GB')} km</text>
				</g>
			</svg>
			<div className={style.viewControls}>
				<label>
					Rotation
					<input
						type="range"
						min="-180"
						max="180"
						value={Math.round(view.turn)}
						aria-valuetext={`${Math.round(view.turn)} degrees longitude`}
						onChange={e =>
							setView({ ...view, turn: e.target.valueAsNumber })
						}
					/>
				</label>
				<label>
					Tilt
					<input
						type="range"
						min="-90"
						max="90"
						value={Math.round(view.tilt)}
						aria-valuetext={`${Math.round(view.tilt)} degrees latitude`}
						onChange={e =>
							setView({ ...view, tilt: e.target.valueAsNumber })
						}
					/>
				</label>
				{markers.length > 0 && (
					<label>
						Zoom
						<input
							type="range"
							min="0"
							max="100"
							step=".1"
							value={
								100 -
								(100 * Math.log(extent / closeExtent)) /
									Math.log(maxExtent / closeExtent)
							}
							aria-valuetext={`${extent.toFixed(1)} Earth radii from centre to edge`}
							onChange={e =>
								setExtent(
									closeExtent *
										(maxExtent / closeExtent) **
											(1 - e.target.valueAsNumber / 100)
								)
							}
						/>
					</label>
				)}
				<button
					type="button"
					onClick={() => {
						setView(initialView);
						setExtent(closeExtent);
					}}
				>
					Reset view
				</button>
			</div>
		</div>
	);
}
