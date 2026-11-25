import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { svgSnapshotPaths } from '#root/ts/3d/svg_scene.js';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';
import { coastlineUrl } from './assets.js';
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
import { OrbitScene } from './orbit_scene.js';
import style from './style.module.css';

const empty: Marker[] = [];
const initialView = { turn: 12, tilt: 24 };
const clamp = (n: number, min: number, max: number) =>
	Math.max(min, Math.min(max, n));
const wrap = (n: number) => ((((n + 180) % 360) + 360) % 360) - 180;
const size = (p: Vector) => Math.hypot(p.x, p.y, p.z);

const closeExtent = 1.5;
const baseWorld = globeWorld();
const initialFrame = globeFrame(
	globeCamera(initialView.turn, initialView.tilt, closeExtent),
	2
);
const initialScene = (
	<g
		className="park-scene"
		aria-hidden="true"
		strokeWidth=".4"
		strokeLinejoin="round"
	>
		{svgSnapshotPaths(
			baseWorld,
			[],
			initialFrame.camera,
			initialFrame.projection
		).map((batch, i) => (
			<g key={i}>
				{batch.map(([path, fill], j) => (
					<path key={j} d={path} fill={fill} stroke={fill} />
				))}
			</g>
		))}
	</g>
);

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
	const initialExtent = selected
		? Math.max(closeExtent, size(selected) * 1.05)
		: closeExtent;
	const [view, setView] = useState(startingView);
	const [extent, setExtent] = useState(initialExtent);
	const frame = useMemo(
		() => globeFrame(globeCamera(view.turn, view.tilt, extent), maxExtent),
		[view, extent, maxExtent]
	);
	const world = useMemo(
		() => (coastline.data ? globeWorld(coastline.data) : baseWorld),
		[coastline.data]
	);
	const drag = useRef<{
		id: number;
		x: number;
		y: number;
		turn: number;
		tilt: number;
		moved: boolean;
	} | null>(null);
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
	return (
		<div className={style.viewer}>
			<svg
				id="orbital-globe"
				tabIndex={-1}
				className={style.globe}
				viewBox={`0 0 ${width} ${height}`}
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
				<OrbitScene
					label="Earth and orbiting debris"
					world={world}
					faces={projected.faces}
					frame={frame}
				>
					{initialScene}
				</OrbitScene>
				{focus?.visible && (
					<>
						{ground?.visible && (
							<line
								x1={ground.x}
								y1={ground.y}
								x2={focus.x}
								y2={focus.y}
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
				<g transform="translate(15 362)" fill="#d5d8cd" fontSize="9">
					<path
						d={`M0,-4v4h${scaleKm / frame.kmPerPixel}v-4`}
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
