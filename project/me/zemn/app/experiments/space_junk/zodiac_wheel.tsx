import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Marker } from './globe_geometry.js';
import { globeCamera, globeFrame, height, width } from './globe_scene.js';
import { OrbitScene } from './orbit_scene.js';
import style from './style.module.css';
import {
	degrees,
	nearestAspects,
	type Placement,
	radians,
	signPosition,
	signs,
} from './zodiac.js';

const empty: Placement[] = [];
const flat = { turn: 0, tilt: 0, spatial: false, panX: 0, panY: 0 };
const band = { D: 1.025, R: 1.055, C: 1.085 };
const clamp = (n: number, min: number, max: number) =>
	Math.max(min, Math.min(max, n));
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

// Moving along a meridian keeps the wheel longitude fixed as the sky unfolds.
function useSkyDepth(spatial: boolean) {
	const [depth, setDepth] = useState(0);
	useEffect(() => {
		if (!spatial) {
			setDepth(0);
			return;
		}
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			setDepth(1);
			return;
		}
		const start = performance.now();
		let frame = requestAnimationFrame(function unfold(now) {
			const t = Math.min(1, (now - start) / 360);
			setDepth(t * t * (3 - 2 * t));
			if (t < 1) frame = requestAnimationFrame(unfold);
		});
		return () => cancelAnimationFrame(frame);
	}, [spatial]);
	return spatial ? depth : 0;
}

export function ZodiacWheel({
	placements = empty,
	selected,
	ascendant,
	onSelect,
}: {
	placements?: Placement[];
	selected?: Placement;
	ascendant?: number;
	onSelect?: (m: Marker) => void;
}) {
	const [view, setView] = useState(flat);
	const [pan, setPan] = useState(false);
	const skyDepth = useSkyDepth(view.spatial);
	const drag = useRef<{
		id: number;
		x: number;
		y: number;
		view: typeof flat;
		pan: boolean;
		moved: boolean;
	} | null>(null);
	const anchor = ascendant ?? 0;
	const frame = useMemo(
		() =>
			globeFrame(
				globeCamera(anchor + 90 + view.turn, 90 - view.tilt, 1.41),
				2,
				false
			),
		[anchor, view.turn, view.tilt]
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
					direction(
						p.longitude,
						p.latitude * skyDepth,
						band[p.marker.object.kind] +
							skyDepth * (1.055 - band[p.marker.object.kind])
					)
				);
				return { p, at };
			}),
		[frame, placements, skyDepth]
	);
	const faces = useMemo(
		() =>
			marks.map(({ p, at }) =>
				frame.symbol(at.center, at.depth, p.marker.object.kind)
			),
		[marks, frame]
	);
	const aspects = useMemo(
		() => (selected ? nearestAspects(selected, placements) : []),
		[selected, placements]
	);
	const focus = selected && marks.find(m => m.p === selected)?.at;
	const labels = signs.map((sign, i) => {
		const mid = i * 30 + 15,
			p = at(mid, 1.335),
			q = at(mid + 0.1, 1.335);
		let angle = Math.atan2(q.y - p.y, q.x - p.x) / radians;
		if (angle > 90) angle -= 180;
		if (angle < -90) angle += 180;
		return { sign, p, angle, visible: true };
	});
	if (view.spatial) {
		const shown: typeof labels = [];
		for (const label of [...labels].sort((a, b) => a.p.depth - b.p.depth)) {
			label.visible = !shown.some(
				other =>
					Math.abs(other.p.y - label.p.y) < 12 &&
					Math.abs(other.p.x - label.p.x) <
						(other.sign.length + label.sign.length) * 2.6
			);
			if (label.visible) shown.push(label);
		}
	}
	function reset() {
		setView(flat);
		setPan(false);
	}
	function pointerDown(e: PointerEvent<SVGSVGElement>) {
		if (!e.isPrimary || e.button !== 0) return;
		drag.current = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			view,
			pan: pan || e.shiftKey,
			moved: false,
		};
		e.currentTarget.setPointerCapture(e.pointerId);
	}
	function pointerMove(e: PointerEvent<SVGSVGElement>) {
		const start = drag.current;
		if (!start || start.id !== e.pointerId) return;
		const dx = e.clientX - start.x,
			dy = e.clientY - start.y;
		if (!start.moved && Math.hypot(dx, dy) < 4) return;
		start.moved = true;
		const scale = width / e.currentTarget.getBoundingClientRect().width;
		if (start.pan)
			setView({
				...start.view,
				panX: clamp(
					start.view.panX + dx * scale,
					-width / 2,
					width / 2
				),
				panY: clamp(
					start.view.panY + dy * scale,
					-height / 2,
					height / 2
				),
			});
		else
			setView({
				...start.view,
				spatial: true,
				turn: degrees(start.view.turn - dx * scale * 0.6 + 180) - 180,
				tilt: clamp(
					start.view.spatial
						? start.view.tilt + dy * scale * 0.5
						: Math.abs(dy) * scale * 0.5,
					0,
					175
				),
			});
	}
	function pointerUp(e: PointerEvent<SVGSVGElement>) {
		const start = drag.current,
			transform = e.currentTarget.getScreenCTM();
		if (
			!start ||
			start.id !== e.pointerId ||
			start.moved ||
			!transform ||
			!onSelect
		)
			return;
		const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(
			transform.inverse()
		);
		let nearest: Placement | undefined;
		let radius = 6;
		for (const m of marks) {
			const distance = Math.hypot(
				m.at.x + view.panX - at.x,
				m.at.y + view.panY - at.y
			);
			if (distance < radius) {
				nearest = m.p;
				radius = distance;
			}
		}
		if (nearest) onSelect(nearest.marker);
	}

	return (
		<div className={style.viewer}>
			<svg
				id="zodiac-wheel"
				className={style.globe}
				tabIndex={0}
				role="img"
				aria-label={
					view.spatial
						? '3D zodiac sky. Drag to orbit. Use arrow keys to rotate or pan.'
						: 'Face-on zodiac wheel. Drag to explore sky directions in 3D.'
				}
				viewBox={`0 0 ${width} ${height}`}
				onPointerDown={pointerDown}
				onPointerMove={pointerMove}
				onPointerUp={pointerUp}
				onLostPointerCapture={() => {
					drag.current = null;
				}}
				onKeyDown={e => {
					if (e.key === 'Home') {
						e.preventDefault();
						reset();
						return;
					}
					const dx =
							Number(e.key === 'ArrowRight') -
							Number(e.key === 'ArrowLeft'),
						dy =
							Number(e.key === 'ArrowDown') -
							Number(e.key === 'ArrowUp');
					if (!dx && !dy) return;
					e.preventDefault();
					setView(v =>
						pan || e.shiftKey
							? {
									...v,
									panX: clamp(
										v.panX + dx * 12,
										-width / 2,
										width / 2
									),
									panY: clamp(
										v.panY + dy * 12,
										-height / 2,
										height / 2
									),
								}
							: {
									...v,
									spatial: true,
									turn: degrees(v.turn + dx * 5 + 180) - 180,
									tilt: clamp(v.tilt + dy * 5, 0, 175),
								}
					);
				}}
			>
				<g transform={`translate(${view.panX} ${view.panY})`}>
					{view.spatial && (
						<g
							fill="none"
							stroke="#718f98"
							strokeWidth=".6"
							opacity={skyDepth * 0.5}
						>
							{[-60, -30, 30, 60].map(lat => (
								<path
									key={lat}
									d={'M' + arc(0, 360, 1.055, lat) + 'Z'}
								/>
							))}
							{Array.from({ length: 12 }, (_, i) => (
								<path
									key={i}
									d={Array.from(
										{ length: 61 },
										(_, j) =>
											(j ? 'L' : 'M') +
											xy(at(i * 30, 1.055, j * 3 - 90))
									).join('')}
								/>
							))}
						</g>
					)}
					{labels.map(({ sign, p, angle, visible }, i) => {
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
									fill={i % 2 ? '#243d4a' : '#203440'}
									stroke="#9caea6"
									strokeWidth=".65"
								/>
								{visible && (
									<text
										transform={`translate(${xy(p)}) rotate(${angle})`}
										textAnchor="middle"
										dominantBaseline="central"
										fill="#f0e8d1"
										fontSize="11.5"
										letterSpacing=".35"
									>
										{sign.toUpperCase()}
									</text>
								)}
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
						stroke="#b5c4b7"
						strokeWidth=".65"
					/>
					<path
						d={'M' + arc(0, 360, 0.97) + 'Z'}
						fill="none"
						stroke="#839995"
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
								stroke={
									angle === 180 || angle === 90
										? '#e2b778'
										: '#92b6b8'
								}
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
					<OrbitScene
						label="Debris directions"
						faces={faces}
						frame={frame}
					/>
					{aspects.map(({ name, placement }) => {
						const p = at(placement.longitude, 0.97);
						return (
							<circle
								key={name}
								cx={p.x}
								cy={p.y}
								r="2"
								fill="#f3ddaf"
							>
								<title>
									{name} · {shortName(placement)}
								</title>
							</circle>
						);
					})}
					{ascendant !== undefined && (
						<g fill="#ffd28a">
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
							{view.spatial && (
								<path
									d={
										'M' +
										xy(at(selected.longitude, 1.055)) +
										'L' +
										xy(focus)
									}
									fill="none"
									stroke="#f6ca80"
									strokeDasharray="2 3"
								/>
							)}
							<circle
								cx={focus.x}
								cy={focus.y}
								r="4"
								fill="#18273b"
								stroke="#ffda90"
								strokeWidth="1.7"
							/>
							<circle
								cx={focus.x}
								cy={focus.y}
								r="1.3"
								fill="#ffda90"
							/>
							<text
								x={focus.x + (focus.x > width / 2 ? -7 : 7)}
								y={focus.y - 6}
								textAnchor={
									focus.x > width / 2 ? 'end' : 'start'
								}
								fontSize="9.5"
								fill="#ffe3a6"
								stroke="#18273b"
								strokeWidth="3"
								paintOrder="stroke"
							>
								{shortName(selected)}
							</text>
						</g>
					)}
					<circle cx={width / 2} cy={height / 2} r="2" fill="#f0e8d1">
						<title>Chart origin</title>
					</circle>
				</g>
			</svg>
			<div className={style.viewControls}>
				<button
					type="button"
					onClick={() =>
						view.spatial || view.panX || view.panY
							? reset()
							: setView({ ...flat, spatial: true, tilt: 52 })
					}
				>
					{view.spatial || view.panX || view.panY
						? 'Return to wheel'
						: 'Explore in 3D'}
				</button>
				<button
					type="button"
					aria-pressed={pan}
					onClick={() => setPan(!pan)}
				>
					Pan
				</button>
				{view.spatial && (
					<label>
						Tilt
						<input
							type="range"
							min="0"
							max="175"
							value={Math.round(view.tilt)}
							aria-valuetext={`${Math.round(view.tilt)} degrees from face-on`}
							onChange={e =>
								setView({
									...view,
									tilt: e.target.valueAsNumber,
								})
							}
						/>
					</label>
				)}
			</div>
			{selected && (
				<div className={style.wheelReading}>
					<strong>{shortName(selected)}</strong> ·{' '}
					{signPosition(selected.longitude)}
					<br />
					{Math.abs(selected.latitude).toFixed(1)}°{' '}
					{selected.latitude < 0 ? 'below' : 'above'} the ecliptic
					{aspects.length > 0 && (
						<details>
							<summary>Aspects to this object</summary>
							<small>
								Closest match within 1° of each major aspect,
								measured around the wheel.
							</small>
							<dl>
								{aspects.map(a => (
									<div key={a.name}>
										<dt>
											{a.name} · {a.separation.toFixed(1)}
											°
										</dt>
										<dd>
											{a.placement.marker.object.name} ·{' '}
											{a.placement.marker.object.id}
										</dd>
									</div>
								))}
							</dl>
						</details>
					)}
				</div>
			)}
		</div>
	);
}
