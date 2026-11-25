import {
	type Ref,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	type ChartMode,
	defaultTurn,
	flat,
	modeAt,
	type PickMarker,
	useChartCamera,
	wrap,
} from './chart_camera.js';
import { Globe } from './globe.js';
import { groundLocation, type Marker, type Vector } from './globe_geometry.js';
import { height, width } from './globe_scene.js';
import { PlanetPositions } from './planet_layer.js';
import type { BodyPosition } from './planets.js';
import style from './style.module.css';
import { type Birthplace, nearestAspects, type zodiacFrame } from './zodiac.js';
import { WheelReading, ZodiacWheel } from './zodiac_wheel.js';

export interface ChartViewerHandle {
	show(mode: ChartMode): void;
}

// Retain the departing drawing until its opacity transition finishes. Reversing
// the gesture lets the browser continue from the current opacity in either direction.
function useProjectionLayer(active: boolean) {
	const group = useRef<SVGGElement>(null);
	const [held, setHeld] = useState(active);
	useLayoutEffect(() => {
		if (active) {
			setHeld(true);
			return;
		}
		const transitions = group.current!.getAnimations();
		if (!transitions.length) {
			setHeld(false);
			return;
		}
		let current = true;
		void Promise.allSettled(transitions.map(t => t.finished)).then(() => {
			if (current) setHeld(false);
		});
		return () => {
			current = false;
		};
	}, [active]);
	return { group, draw: active || held };
}

const closeExtent = 1.5;
const radius = (p: Vector) => Math.hypot(p.x, p.y, p.z);

export function ChartViewer({
	ref,
	onMode,
	instant,
	bodies,
	showSigns,
	birthplace,
	markers,
	selected,
	revision,
	zodiac,
	ascendant,
	onSelect,
}: {
	ref: Ref<ChartViewerHandle>;
	onMode: (mode: ChartMode) => void;
	instant: number;
	bodies: BodyPosition[];
	showSigns: boolean;
	birthplace?: Birthplace & { name?: string };
	markers: Marker[];
	selected?: Marker;
	revision?: number;
	zodiac: ReturnType<typeof zodiacFrame>;
	ascendant?: number;
	onSelect: (marker: Marker) => void;
}) {
	const controls = useChartCamera();
	const { camera, move, mode } = controls;
	const wheel = mode === 'wheel';
	const wheelLayer = useProjectionLayer(wheel),
		earthLayer = useProjectionLayer(!wheel);
	const wheelPick = useRef<PickMarker>(null),
		earthPick = useRef<PickMarker>(null);
	const [extent, setExtent] = useState(closeExtent);
	const maxExtent = useMemo(
		() => markers.reduce((m, p) => Math.max(m, radius(p) * 1.05), 2),
		[markers]
	);
	const placements = useMemo(
		() =>
			wheelLayer.draw
				? markers.map(marker => ({
						marker,
						...zodiac.direction(marker.fixed),
					}))
				: [],
		[wheelLayer.draw, markers, zodiac]
	);
	const focus = useMemo(
		() => placements.find(p => p.marker === selected) ?? placements[0],
		[placements, selected]
	);

	const aspects = useMemo(
		() => (focus ? nearestAspects(focus, placements) : []),
		[focus, placements]
	);

	function faceEarth(longitude: number, latitude: number, zoom: number) {
		// Leave a polar birthplace in sight while keeping the globe open.
		move({
			...flat,
			turn: wrap(longitude),
			tilt: Math.max(-86, Math.min(86, latitude)),
		});
		setExtent(zoom);
	}
	function home() {
		faceEarth(
			birthplace?.longitude ?? defaultTurn,
			birthplace?.latitude ?? 24,
			closeExtent
		);
	}
	function locate() {
		if (!selected) {
			home();
			return;
		}
		const p = groundLocation(selected);
		faceEarth(
			p.longitude - 24,
			p.latitude * 0.8,
			Math.max(closeExtent, radius(selected) * 1.05)
		);
	}
	useImperativeHandle(ref, () => ({
		show(next) {
			if (next === modeAt(controls.latest.current.tilt)) return;
			if (next === 'earth') locate();
			else move(flat);
		},
	}));
	useLayoutEffect(() => onMode(mode), [onMode, mode]);
	const previous = useRef({ birthplace, revision });
	useLayoutEffect(() => {
		if (!wheel) {
			if (revision !== previous.current.revision) locate();
			else if (birthplace && birthplace !== previous.current.birthplace)
				home();
		}
		previous.current = { birthplace, revision };
	}, [birthplace, revision, wheel]);

	return (
		<div className={style.viewer}>
			<svg
				id={wheel ? 'zodiac-wheel' : 'orbital-globe'}
				ref={controls.svg}
				className={style.globe}
				tabIndex={0}
				role="img"
				aria-label={
					wheel
						? `Face-on zodiac wheel from ${camera.tilt < 0 ? 'below' : 'above'}. Tilt to see Earth orbits.`
						: 'Earth and orbital chart. Drag or use the arrow keys to rotate. Tilt face-on to see the zodiac wheel.'
				}
				viewBox={`0 0 ${width} ${height}`}
				onKeyDown={controls.keyDown}
				onPointerDown={controls.pointerDown}
				onPointerMove={controls.pointerMove}
				onPointerUp={e => {
					const hit = controls.pointerUp(e, p =>
						(wheel ? wheelPick : earthPick).current?.(p)
					);
					if (hit) onSelect(hit);
				}}
				onPointerCancel={controls.endPointer}
				onLostPointerCapture={controls.endPointer}
			>
				<desc>
					Use Shift and the arrow keys, Shift-drag, or drag with two
					fingers to pan.
				</desc>
				<g transform={`translate(${camera.panX} ${camera.panY})`}>
					<g
						ref={wheelLayer.group}
						className={style.projection}
						aria-hidden={!wheel}
						opacity={wheel ? 1 : 0}
					>
						{wheelLayer.draw && (
							<ZodiacWheel
								camera={camera}
								pick={wheelPick}
								bodies={bodies}
								placements={placements}
								aspects={aspects}
								ascendant={ascendant}
								selected={focus}
							/>
						)}
					</g>
					<g
						ref={earthLayer.group}
						className={style.projection}
						aria-hidden={wheel}
						opacity={wheel ? 0 : 1}
					>
						{earthLayer.draw && (
							<Globe
								camera={camera}
								pick={earthPick}
								extent={extent}
								instant={instant}
								bodies={bodies}
								showSigns={showSigns}
								birthplace={birthplace}
								markers={markers}
								selected={selected}
							/>
						)}
					</g>
				</g>
			</svg>
			<PlanetPositions bodies={bodies} />
			{wheel && focus && (
				<WheelReading selected={focus} aspects={aspects} />
			)}
			{!wheel && (
				<details className={style.camera}>
					<summary>View controls</summary>
					<div className={style.viewControls}>
						<label>
							Rotation
							<input
								type="range"
								min="-180"
								max="180"
								value={Math.round(camera.turn)}
								aria-valuetext={`${Math.round(camera.turn)} degrees longitude`}
								onChange={e =>
									move({
										...camera,
										turn: e.target.valueAsNumber,
									})
								}
							/>
						</label>
						<label>
							Tilt
							<input
								type="range"
								min="-90"
								max="90"
								value={Math.round(camera.tilt)}
								aria-valuetext={`${Math.round(camera.tilt)} degrees latitude`}
								onChange={e => {
									const tilt = e.target.valueAsNumber;
									const faceOn = modeAt(tilt) === 'wheel';
									if (faceOn)
										controls.svg.current?.focus({
											preventScroll: true,
										});
									move({
										...camera,
										tilt: faceOn
											? Math.sign(tilt) * 90
											: tilt,
									});
								}}
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
													(1 -
														e.target.valueAsNumber /
															100)
										)
									}
								/>
							</label>
						)}
						<label className={style.spin}>
							<input
								type="checkbox"
								checked={controls.spin}
								onChange={e =>
									controls.setSpin(e.target.checked)
								}
							/>
							Auto-rotate
						</label>
						<button type="button" onClick={home}>
							Reset view
						</button>
					</div>
				</details>
			)}
		</div>
	);
}
