import { KM_PER_AU } from 'astronomy-engine';
import { useQueryState } from 'nuqs';
import { type ReactNode, useLayoutEffect, useMemo, useRef } from 'react';
import {
	defaultTurn,
	flat,
	orbitalTiltLimit,
	type PickMarker,
	settlingMidpoint,
	useChartCamera,
	wrap,
} from './chart_camera.js';
import { chartGeometry } from './chart_geometry.js';
import { boundedNumber, objectAnchor } from './chart_query.js';
import { Globe } from './globe.js';
import {
	equatorialRadius,
	groundLocation,
	type Marker,
	type Vector,
} from './globe_geometry.js';
import { globeCamera, height, viewWidthKm, width } from './globe_scene.js';
import { type BodyPosition, earthFixedSky } from './planets.js';
import { SlideRule } from './slide_rule.js';
import style from './style.module.css';
import { type Birthplace, nearestAspects, type zodiacFrame } from './zodiac.js';

const closeExtent = 1.5;
const tiltBands = [
	{
		start: -90,
		split: -settlingMidpoint,
		end: -orbitalTiltLimit,
		startLabel: 'Wheel',
		endLabel: 'Orbit →',
	},
	{
		start: orbitalTiltLimit,
		split: settlingMidpoint,
		end: 90,
		startLabel: '← Orbit',
		endLabel: 'Wheel',
	},
];
// Keep the ruler in physical units even when the visible catalogue changes.
const maxExtent = (60 * KM_PER_AU) / equatorialRadius;
const kmAcrossPerExtent = viewWidthKm(globeCamera(0, 0, 1));
const distanceFormat = new Intl.NumberFormat('en-GB', {
	maximumSignificantDigits: 3,
});
function formatDistance(km: number) {
	return km < 1_000_000
		? `${distanceFormat.format(km)} km`
		: `${distanceFormat.format(km / KM_PER_AU)} AU`;
}
function formatViewWidth(extent: number) {
	return formatDistance(kmAcrossPerExtent * extent);
}
function extentAtZoom(zoom: number) {
	return closeExtent * (maxExtent / closeExtent) ** (1 - zoom / 100);
}
const zoomParser = boundedNumber(0, 100).withDefault(100);
function zoomAtExtent(extent: number) {
	return (
		100 -
		(100 * Math.log(extent / closeExtent)) /
			Math.log(maxExtent / closeExtent)
	);
}
const earthZoomMark = {
	position: zoomAtExtent(closeExtent),
	glyph: '⊕',
	label: `Earth · ${formatViewWidth(closeExtent)} across`,
};
const radius = (p: Vector) => Math.hypot(p.x, p.y, p.z);

export function ChartViewer({
	children,
	instant,
	bodies,
	showSigns,
	birthplace,
	cityRevision,
	linkedId,
	markers,
	selected,
	revision,
	zodiac,
	ascendant,
	onSelect,
}: {
	children: ReactNode;
	instant: number;
	bodies: BodyPosition[];
	showSigns: boolean;
	cityRevision: number;
	birthplace?: Birthplace & { name?: string };
	markers: Marker[];
	selected?: Marker;
	revision: number;
	linkedId: number | null;
	zodiac: ReturnType<typeof zodiacFrame>;
	ascendant?: number;
	onSelect: (marker: Marker) => void;
}) {
	const controls = useChartCamera();
	const { camera, move, faceOn, unfold } = controls;
	const pick = useRef<PickMarker>(null);
	const [zoomValue, setZoom] = useQueryState('zoom', zoomParser);
	const extent = extentAtZoom(zoomValue);
	const viewWidth = formatViewWidth(extent);
	const fixed = useMemo(() => earthFixedSky(new Date(instant)), [instant]);
	const { turn, tilt } = camera;
	const geometry = useMemo(
		() => chartGeometry({ turn, tilt }, extent, unfold, fixed),
		[turn, tilt, extent, unfold, fixed]
	);
	const zoomMarks = bodies.flatMap(body => {
		const extent = Math.max(
			closeExtent,
			geometry.frame.extentToFrame(
				body.position,
				camera.panX,
				camera.panY
			)
		);
		if (extent > maxExtent) return [];
		return [
			{
				position: zoomAtExtent(extent),
				glyph: body.glyph,
				label: `${body.name} · ${formatDistance(body.distanceKm)} from Earth · ${formatViewWidth(extent)} across`,
			},
		];
	});
	zoomMarks.push(earthZoomMark);
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
		zoomTo(zoomAtExtent(radius));
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
	const target =
		selected && selected.object.id === linkedId ? linkedId : null;
	const previous = useRef({
		cityRevision,
		revision,
		target: null as number | null,
	});
	useLayoutEffect(() => {
		if (
			target !== null &&
			(target !== previous.current.target ||
				revision !== previous.current.revision)
		) {
			if (!faceOn) locate();
			// Resolve the native target if the browser first saw this URL before the archive loaded.
			const id = objectAnchor(target);
			const marker = document.getElementById(id);
			if (
				window.location.hash === '#' + id &&
				marker &&
				!marker.matches(':target')
			)
				window.location.replace(window.location.hash);
			controls.svg.current?.scrollIntoView({ block: 'center' });
			controls.svg.current?.focus({ preventScroll: true });
		} else if (
			!faceOn &&
			birthplace &&
			cityRevision !== previous.current.cityRevision
		) {
			home();
		}
		previous.current = { cityRevision, revision, target };
	}, [birthplace, cityRevision, revision, faceOn, target]);

	const rulerEvents = {
		onGrab: controls.grabRuler,
		onRelease: controls.releaseRuler,
	};
	function rotate(value: number) {
		move({ ...controls.readCamera(), turn: value });
	}
	function tiltTo(value: number) {
		move({
			...controls.readCamera(),
			tilt: Math.max(-90, Math.min(90, value)),
		});
	}
	function zoomTo(value: number) {
		const zoom = Math.max(0, Math.min(100, value));
		void setZoom(zoom);
	}

	return (
		<div className={style.viewer}>
			<svg
				id="star-chart"
				onKeyUp={controls.keyUp}
				onBlur={() => controls.settle()}
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
			<p className={style.printView}>
				{faceOn ? 'Zodiac wheel' : `Earth orbits · ${viewWidth} across`}
			</p>
			<div
				role="group"
				aria-label="View controls"
				onKeyUp={controls.keyUp}
				onBlur={() => controls.settle()}
				className={style.viewControls}
			>
				<SlideRule
					{...rulerEvents}
					label="Rotation"
					readout={`${Math.round(turn)}°`}
					centre={turn}
					min={-Infinity}
					max={Infinity}
					pitch={4}
					tick={5}
					major={15}
					tickLabel={mark => `${wrap(mark)}°`}
					readPosition={() => controls.readCamera().turn}
					seek={value => rotate(wrap(value))}
					inputProps={{
						min: -180,
						max: 180,
						value: Math.round(turn),
						'aria-valuetext': `${Math.round(turn)} degrees longitude`,
						onChange: e => rotate(e.currentTarget.valueAsNumber),
					}}
				>
					<label className={`${style.rulerValue} ${style.switch}`}>
						<span>Auto-rotate</span>
						<input
							type="checkbox"
							checked={controls.spin}
							onChange={e => controls.setSpin(e.target.checked)}
						/>
					</label>
				</SlideRule>
				<SlideRule
					{...rulerEvents}
					label="Tilt"
					bands={tiltBands}
					readout={`${Math.round(tilt)}°`}
					centre={tilt}
					min={-90}
					max={90}
					pitch={4}
					tick={5}
					major={15}
					tickLabel={mark => `${mark}°`}
					readPosition={() => controls.readCamera().tilt}
					seek={tiltTo}
					inputProps={{
						min: -90,
						max: 90,
						value: Math.round(tilt),
						'aria-valuetext': `${Math.round(tilt)} degrees latitude`,
						'aria-description': `The chart blends from orbit to wheel between ${orbitalTiltLimit} and 90 degrees in either direction. Release past ${settlingMidpoint} degrees toward either pole to settle into Wheel. The other half settles into Orbit.`,
						onChange: e => tiltTo(e.currentTarget.valueAsNumber),
					}}
				/>
				<SlideRule
					{...rulerEvents}
					label="Orbit view width"
					marks={zoomMarks}
					readout={viewWidth}
					centre={zoomValue}
					min={0}
					max={100}
					pitch={8}
					tick={2}
					major={10}
					tickLabel={mark => formatViewWidth(extentAtZoom(mark))}
					readPosition={() => zoomValue}
					seek={zoomTo}
					inputProps={{
						min: 0,
						max: 100,
						step: 0.1,
						value: zoomValue,
						'aria-valuetext': `${viewWidth} across at Earth’s centre`,
						'aria-description':
							'Orbit view widths: ' +
							zoomMarks.map(mark => mark.label).join('; '),
						onChange: e => zoomTo(e.currentTarget.valueAsNumber),
					}}
				/>
			</div>
			{children}
		</div>
	);
}
