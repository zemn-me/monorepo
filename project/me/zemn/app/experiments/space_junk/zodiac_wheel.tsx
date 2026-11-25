import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { Marker } from './globe_geometry.js';
import { globeCamera, globeFrame, height, width } from './globe_scene.js';
import { PlanetLayer } from './planet_layer.js';
import type { BodyPosition } from './planets.js';
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
const flat = { turn: 0, tilt: 0, panX: 0, panY: 0 };
const band = { D: 1.025, R: 1.055, C: 1.085 };
const clamp = (n: number, min: number, max: number) =>
	Math.max(min, Math.min(max, n));
const poleSnap = 3;
function snapTilt(tilt: number) {
	if (tilt <= poleSnap) return 0;
	if (tilt >= 180 - poleSnap) return 180;
	return tilt;
}
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
	bodies,
	selected,
	ascendant,
	onSelect,
}: {
	placements?: Placement[];
	bodies: BodyPosition[];
	selected?: Placement;
	ascendant?: number;
	onSelect?: (m: Marker) => void;
}) {
	const [view, setView] = useState(flat);
	const wheel = useRef<SVGSVGElement>(null);
	const distanceToPole = Math.min(view.tilt, 180 - view.tilt);
	const spatial = distanceToPole > 0;
	// Bring latitude back into the wheel gradually near either ecliptic pole.
	const t = clamp((distanceToPole - poleSnap) / 12, 0, 1);
	const skyDepth = useSkyDepth(spatial) * t * t * (3 - 2 * t);
	const pointers = useRef(new Map<number, { x: number; y: number }>());
	const drag = useRef<{
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
				frame.symbol(at.center, at.depth, p.marker.object.kind, 0.58)
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
	if (spatial) {
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
	function pointerCenter(e: PointerEvent<SVGSVGElement>) {
		const point = { x: e.clientX, y: e.clientY };
		pointers.current.set(e.pointerId, point);
		const [a, b] = pointers.current.values();
		return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : point;
	}
	function pointerDown(e: PointerEvent<SVGSVGElement>) {
		const secondTouch =
			e.pointerType === 'touch' &&
			!e.isPrimary &&
			pointers.current.size === 1;
		if (
			e.button !== 0 ||
			!(secondTouch || (e.isPrimary && pointers.current.size === 0))
		)
			return;
		drag.current = {
			...pointerCenter(e),
			view,
			pan: secondTouch || e.shiftKey,
			moved: secondTouch,
		};
		e.currentTarget.setPointerCapture(e.pointerId);
	}
	function endPointer(e: PointerEvent<SVGSVGElement>) {
		if (pointers.current.delete(e.pointerId)) drag.current = null;
	}
	function pointerMove(e: PointerEvent<SVGSVGElement>) {
		if (!pointers.current.has(e.pointerId)) return;
		const point = pointerCenter(e);
		const start = drag.current;
		if (!start) return;
		const dx = point.x - start.x,
			dy = point.y - start.y;
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
		else {
			const tilt = start.view.tilt;
			const delta = dy * scale * 0.5;
			setView({
				...start.view,
				turn: degrees(start.view.turn - dx * scale * 0.6 + 180) - 180,
				tilt: snapTilt(
					tilt === 0
						? Math.abs(delta)
						: tilt === 180
							? 180 - Math.abs(delta)
							: tilt + delta
				),
			});
		}
	}
	function pointerUp(e: PointerEvent<SVGSVGElement>) {
		if (!pointers.current.has(e.pointerId)) return;
		const start = drag.current;
		endPointer(e);
		const transform = e.currentTarget.getScreenCTM();
		if (!start || start.moved || !transform || !onSelect) return;
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
				ref={wheel}
				id="zodiac-wheel"
				className={style.globe}
				tabIndex={onSelect ? 0 : undefined}
				role="img"
				aria-label={
					!onSelect
						? 'The twelve signs of the zodiac'
						: spatial
							? '3D zodiac sky. Drag or use arrow keys to rotate. Hold Shift or drag with two fingers to pan.'
							: `Face-on zodiac wheel from ${view.tilt === 180 ? 'below' : 'above'}. Tilt to explore in 3D.`
				}
				viewBox={`0 0 ${width} ${height}`}
				onPointerDown={onSelect && pointerDown}
				onPointerMove={onSelect && pointerMove}
				onPointerUp={onSelect && pointerUp}
				onPointerCancel={endPointer}
				onLostPointerCapture={endPointer}
				onKeyDown={e => {
					if (e.key === 'Home') {
						e.preventDefault();
						setView(flat);
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
						e.shiftKey
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
									turn: degrees(v.turn + dx * 5 + 180) - 180,
									tilt: snapTilt(v.tilt + dy * 5),
								}
					);
				}}
			>
				<g transform={`translate(${view.panX} ${view.panY})`}>
					{spatial && (
						<g
							fill="none"
							stroke="currentColor"
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
									fill="none"
									stroke="currentColor"
									strokeOpacity=".52"
									strokeWidth=".65"
								/>
								{visible && (
									<text
										transform={`translate(${xy(p)}) rotate(${angle})`}
										textAnchor="middle"
										dominantBaseline="central"
										fill="currentColor"
										fontSize="11.5"
										letterSpacing=".45"
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
							project={body =>
								at(
									body.longitude,
									0.87 + 0.185 * skyDepth,
									body.latitude * skyDepth
								)
							}
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
							{spatial && (
								<path
									d={
										'M' +
										xy(at(selected.longitude, 1.055)) +
										'L' +
										xy(focus)
									}
									fill="none"
									stroke="currentColor"
									strokeDasharray="2 3"
								/>
							)}
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
								textAnchor={
									focus.x > width / 2 ? 'end' : 'start'
								}
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
					<circle
						cx={width / 2}
						cy={height / 2}
						r="2"
						fill="currentColor"
					>
						<title>Chart origin</title>
					</circle>
				</g>
			</svg>
			{onSelect && !spatial && (
				<div className={style.viewControls}>
					<button
						type="button"
						onClick={() => {
							wheel.current?.focus({ preventScroll: true });
							setView(v => ({
								...v,
								tilt: v.tilt === 180 ? 128 : 52,
							}));
						}}
					>
						Explore in 3D
					</button>
				</div>
			)}
			{bodies.length > 0 && (
				<details className={style.reading}>
					<summary>Planet positions</summary>
					<dl>
						{bodies.map(body => (
							<div key={body.name}>
								<dt>
									{body.glyph}
									{'\uFE0E'} {body.name}
								</dt>
								<dd>{signPosition(body.longitude)}</dd>
							</div>
						))}
					</dl>
				</details>
			)}
			{selected && (
				<details className={style.reading}>
					<summary>
						{shortName(selected)} ·{' '}
						{signPosition(selected.longitude)}
					</summary>
					<p>
						{Math.abs(selected.latitude).toFixed(1)}°{' '}
						{selected.latitude < 0 ? 'below' : 'above'} the
						ecliptic.
					</p>
					{aspects.length > 0 && (
						<>
							<p>Closest aspects within 1°</p>
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
						</>
					)}
				</details>
			)}
		</div>
	);
}
