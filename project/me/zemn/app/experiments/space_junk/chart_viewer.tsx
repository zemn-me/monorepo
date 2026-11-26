import { KM_PER_AU } from 'astronomy-engine';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
	defaultTurn,
	flat,
	orbitalTiltLimit,
	type PickMarker,
	useChartCamera,
	wrap,
} from './chart_camera.js';
import { chartGeometry } from './chart_geometry.js';
import { Globe } from './globe.js';
import {
	equatorialRadius,
	groundLocation,
	type Marker,
	type Vector,
} from './globe_geometry.js';
import { height, width } from './globe_scene.js';
import { type BodyPosition, earthFixedSky } from './planets.js';
import style from './style.module.css';
import { type Birthplace, nearestAspects, type zodiacFrame } from './zodiac.js';

const closeExtent = 1.5;
// Keep the ruler in physical units even when the visible catalogue changes.
const maxExtent = (60 * KM_PER_AU) / equatorialRadius;
const radius = (p: Vector) => Math.hypot(p.x, p.y, p.z);

export function ChartViewer({
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
	const { camera, move, faceOn, unfold } = controls;
	const pick = useRef<PickMarker>(null);
	const [extent, setExtent] = useState(closeExtent);
	const zoomValue =
		100 -
		(100 * Math.log(extent / closeExtent)) /
			Math.log(maxExtent / closeExtent);
	const fixed = useMemo(() => earthFixedSky(new Date(instant)), [instant]);
	const { turn, tilt } = camera;
	const geometry = useMemo(
		() => chartGeometry({ turn, tilt }, extent, unfold, fixed),
		[turn, tilt, extent, unfold, fixed]
	);
	const placements = useMemo(
		() =>
			markers.map(marker => ({
				marker,
				...zodiac.direction(marker.fixed),
			})),
		[markers, zodiac]
	);
	const focus = useMemo(
		() => placements.find(p => p.marker === selected) ?? placements[0],
		[placements, selected]
	);

	const aspects = useMemo(
		() => (focus ? nearestAspects(focus, placements) : []),
		[focus, placements]
	);

	function faceEarth(longitude: number, latitude: number, radius: number) {
		// Frame a polar birthplace just off the pole so its surface marker stays visible.
		move({
			...flat,
			turn: wrap(longitude),
			tilt: Math.max(
				-orbitalTiltLimit,
				Math.min(orbitalTiltLimit, latitude)
			),
		});
		setExtent(radius);
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
	const previous = useRef({ birthplace, revision });
	useLayoutEffect(() => {
		if (!faceOn) {
			if (revision !== previous.current.revision) locate();
			else if (birthplace && birthplace !== previous.current.birthplace)
				home();
		}
		previous.current = { birthplace, revision };
	}, [birthplace, revision, faceOn]);

	return (
		<div
			className={style.viewer}
			onKeyUp={controls.keyUp}
			onBlur={() => controls.settle()}
		>
			<svg
				id="star-chart"
				ref={controls.svg}
				className={style.globe}
				tabIndex={0}
				role="img"
				aria-label={
					faceOn
						? `Face-on zodiac wheel from ${camera.tilt < 0 ? 'below' : 'above'}. Tilt to see Earth orbits.`
						: 'Earth and orbital chart. Drag or use the arrow keys to rotate. Tilt face-on to see the zodiac wheel.'
				}
				viewBox={`0 0 ${width} ${height}`}
				onKeyDown={controls.keyDown}
				onPointerDown={controls.pointerDown}
				onPointerMove={controls.pointerMove}
				onPointerUp={e => {
					const hit = controls.pointerUp(e, p => pick.current?.(p));
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
					<Globe
						geometry={geometry}
						pick={pick}
						bodies={bodies}
						showSigns={showSigns}
						birthplace={birthplace}
						markers={markers}
						placements={placements}
						ascendant={ascendant}
						aspects={aspects}
						selection={focus}
					/>
				</g>
			</svg>
			<details className={style.camera}>
				<summary>View controls</summary>
				<div className={style.viewControls}>
					<label>
						Rotation
						<input
							{...controls.rangeEvents}
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
							{...controls.rangeEvents}
							type="range"
							min="-90"
							max="90"
							value={Math.round(camera.tilt)}
							aria-valuetext={`${Math.round(camera.tilt)} degrees latitude`}
							onChange={e =>
								move({
									...camera,
									tilt: e.target.valueAsNumber,
								})
							}
						/>
					</label>
					<label>
						Zoom
						<input
							{...controls.rangeEvents}
							type="range"
							min="0"
							max="100"
							step=".1"
							value={zoomValue}
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
					<label className={style.spin}>
						<input
							type="checkbox"
							checked={controls.spin}
							onChange={e => controls.setSpin(e.target.checked)}
						/>
						Auto-rotate
					</label>
					<button type="button" onClick={home}>
						Reset view
					</button>
				</div>
			</details>
		</div>
	);
}
