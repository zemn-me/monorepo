import { memo, useId, useMemo, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { SpaceObject } from './chart.js';
import style from './style.module.css';

// Use the same silhouettes for catalogue entries and their local sky positions.
export function ObjectGlyph({ object }: { object: SpaceObject }) {
	const paths = {
		D: 'M-9 -4 1 -9 8 -3 4 6 -4 9Z M-9 -4 0 -1 1 -9 M0 -1 4 6 M0 -1 -4 9',
		C:
			object.id === 29257
				? 'M-6 -9H2V-2Q2 0 -1 1L-1 9H-3V1Q-6 0 -6 -2Z M-4 -7V-3 M-1 -7V-3'
				: 'M-8 -4 -2 -8 8 -3 8 4 2 8 -8 3Z M-8 -4 2 1 8 -3 M2 1V8',
		R: 'M-4 -7Q0 -10 4 -7V5H-4Z M-4 -5Q0 -3 4 -5 M-4 3H4 M-2 5 -4 9H4L2 5',
	};
	return (
		<svg aria-hidden="true" height="26" viewBox="-13 -13 26 26" width="26">
			<path
				d={paths[object.kind]}
				fill="none"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth="1.35"
				transform="rotate(-23)"
			/>
		</svg>
	);
}

const radians = Math.PI / 180;
const initialView = { turn: 12, tilt: 32 };
const minTilt = 20;
const maxTilt = 78;
const globeRadius = 44;
const globeHeight = 10;

type Point = { x: number; y: number };
function coords(p: Point) {
	return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
}
function face(...points: Point[]) {
	return 'M' + points.map(coords).join('L') + 'Z';
}
function turnAngle(angle: number) {
	return ((((angle + 180) % 360) + 360) % 360) - 180;
}
function tiltAngle(angle: number) {
	return Math.min(maxTilt, Math.max(minTilt, angle));
}

function calendar(year: number, releases: readonly number[]) {
	const january = Temporal.PlainDate.from({ year, month: 1, day: 1 });
	const angle = (day: number) => (2 * Math.PI * day) / january.daysInYear;
	const peak = Math.max(1, ...releases);
	const days = Array.from({ length: january.daysInYear }, (_, day) => {
		const count = releases[day] ?? 0;
		return {
			day,
			angle: angle(day),
			height: 86 * Math.sqrt(count / peak),
			count,
			label: count
				? january
						.add({ days: day })
						.toLocaleString('en-GB', {
							day: 'numeric',
							month: 'long',
						})
				: '',
		};
	});
	const months = Array.from({ length: 12 }, (_, i) => {
		const first = january.with({ month: i + 1 });
		return {
			angle: angle(first.dayOfYear - 1),
			middle: angle(first.dayOfYear - 1 + first.daysInMonth / 2),
			label: first.toLocaleString('en', { month: 'short' }),
		};
	});
	return { days, months };
}

const emptyReleases: number[] = [];

export const Wheel = memo(function Wheel({
	birthday,
	releases = emptyReleases,
}: {
	birthday?: Temporal.PlainDate;
	releases?: number[];
}) {
	const year = birthday?.year ?? 2019;
	const { days, months } = useMemo(
		() => calendar(year, releases),
		[year, releases]
	);
	const [view, setView] = useState(initialView);
	const drag = useRef<{
		pointer: number;
		x: number;
		y: number;
		width: number;
		turn: number;
		tilt: number;
	} | null>(null);
	const gradient = useId();
	const sinTilt = Math.sin(view.tilt * radians);
	const cosTilt = Math.cos(view.tilt * radians);

	// Orthographic projection of a horizontal ring, viewed from above its plane.
	function project(angle: number, radius: number, height = 0) {
		const bearing = angle + view.turn * radians;
		const depth = -radius * Math.cos(bearing);
		return {
			x: radius * Math.sin(bearing),
			y: depth * sinTilt - height * cosTilt,
			depth: depth * cosTilt + height * sinTilt,
		};
	}
	const bars = days
		.filter(day => day.count)
		.map(day => {
			const gap = (Math.PI * 0.43) / days.length;
			const near = project(day.angle, 103).depth >= 0;
			const side =
				Math.sin(day.angle + view.turn * radians) > 0 ? gap : -gap;
			const rim = near ? 109 : 98;
			const top = (offset: number, radius: number) =>
				project(day.angle + offset, radius, day.height);
			const base = (offset: number, radius: number) =>
				project(day.angle + offset, radius);
			return {
				depth: project(day.angle, 103).depth,
				mark: (
					<g key={day.day} className={style.bar}>
						<title>
							{day.label} · {day.count.toLocaleString('en-GB')}{' '}
							{day.count === 1 ? 'object' : 'objects'}
						</title>
						<path
							fill={near ? '#5caaa2' : '#438582'}
							d={face(
								base(side, 98),
								base(side, 109),
								top(side, 109),
								top(side, 98)
							)}
						/>
						<path
							fill={near ? '#b0d9c6' : '#86beb4'}
							d={face(
								base(-gap, rim),
								base(gap, rim),
								top(gap, rim),
								top(-gap, rim)
							)}
						/>
						<path
							fill="#d7e9cb"
							d={face(
								top(-gap, 98),
								top(-gap, 109),
								top(gap, 109),
								top(gap, 98)
							)}
						/>
					</g>
				),
			};
		})
		.sort((a, b) => a.depth - b.depth);

	// Draw only the visible hemisphere of each engraved parallel and meridian.
	function globeLine(latitude: number | null, longitude: number) {
		let path = '',
			previousVisible = false;
		for (let i = 0; i <= 90; i++) {
			const lat = (latitude ?? i * 2 - 90) * radians;
			const lon = (latitude === null ? longitude : i * 4) * radians;
			const p = project(
				lon,
				globeRadius * Math.cos(lat),
				globeRadius * Math.sin(lat)
			);
			const visible = p.depth >= 0;
			if (visible) path += (previousVisible ? 'L' : 'M') + coords(p);
			previousVisible = visible;
		}
		return path;
	}
	const marker =
		birthday &&
		project((2 * Math.PI * (birthday.dayOfYear - 1)) / days.length, 134);
	const ticks = days
		.map(
			day =>
				'M' +
				coords(project(day.angle, 126)) +
				'L' +
				coords(project(day.angle, 129))
		)
		.join('');
	const boundaries = months
		.map(
			month =>
				'M' +
				coords(project(month.angle, 91)) +
				'L' +
				coords(project(month.angle, 132))
		)
		.join('');
	return (
		<div className={style.viewer}>
			<svg
				className={style.wheel}
				viewBox="-164 -154 328 308"
				role="img"
				aria-label="3D calendar of debris release anniversaries. Drag to rotate or use the rotation and tilt controls."
				onPointerDown={e => {
					if (!e.isPrimary || e.button !== 0) return;
					drag.current = {
						pointer: e.pointerId,
						x: e.clientX,
						y: e.clientY,
						width: e.currentTarget.getBoundingClientRect().width,
						...view,
					};
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={e => {
					const start = drag.current;
					if (!start || start.pointer !== e.pointerId) return;
					const scale = 240 / start.width;
					setView({
						turn: turnAngle(
							start.turn - (e.clientX - start.x) * scale
						),
						tilt: tiltAngle(
							start.tilt + ((e.clientY - start.y) * scale) / 2
						),
					});
				}}
				onLostPointerCapture={e => {
					if (drag.current?.pointer === e.pointerId)
						drag.current = null;
				}}
			>
				<defs>
					<radialGradient id={gradient} cx="30%" cy="24%" r="80%">
						<stop offset="0" stopColor="#699989" />
						<stop offset=".44" stopColor="#375d60" />
						<stop offset=".84" stopColor="#1d384c" />
						<stop offset="1" stopColor="#162a3d" />
					</radialGradient>
				</defs>
				<g className={style.dial} fill="none">
					{[75, 92, 121, 132].map(radius => (
						<ellipse
							key={radius}
							rx={radius}
							ry={radius * sinTilt}
						/>
					))}
					<path d={ticks} />
					<path d={boundaries} />
				</g>
				{bars.filter(bar => bar.depth < 0).map(bar => bar.mark)}
				<g transform={`translate(0 ${-globeHeight * cosTilt})`}>
					<circle
						r={globeRadius}
						style={{ fill: `url(#${gradient})` }}
						className={style.earth}
					/>
					<g fill="none" className={style.graticule}>
						{[-60, -30, 0, 30, 60].map(lat => (
							<path key={lat} d={globeLine(lat, 0)} />
						))}
						{Array.from({ length: 12 }, (_, i) => (
							<path key={i} d={globeLine(null, i * 30)} />
						))}
					</g>
				</g>
				{bars.filter(bar => bar.depth >= 0).map(bar => bar.mark)}
				{months.map(month => {
					const p = project(month.middle, 146);
					return (
						<text
							key={month.label}
							x={p.x}
							y={p.y}
							className={style.month}
							textAnchor="middle"
							dy=".35em"
						>
							{month.label}
						</text>
					);
				})}
				{marker && (
					<path
						className={style.star}
						transform={`translate(${coords(marker)})`}
						d="M0 -7 2 -2 7 0 2 2 0 7 -2 2 -7 0 -2 -2Z"
					>
						<title>Your birthday</title>
					</path>
				)}
			</svg>
			<div className={style.viewControls}>
				<label>
					Rotation
					<input
						type="range"
						min={-180}
						max={180}
						value={Math.round(view.turn)}
						aria-valuetext={`${Math.round(view.turn)} degrees`}
						onChange={e =>
							setView({ ...view, turn: e.target.valueAsNumber })
						}
					/>
				</label>
				<label>
					Tilt
					<input
						type="range"
						min={minTilt}
						max={maxTilt}
						value={Math.round(view.tilt)}
						aria-valuetext={`${Math.round(view.tilt)} degrees`}
						onChange={e =>
							setView({ ...view, tilt: e.target.valueAsNumber })
						}
					/>
				</label>
				<button type="button" onClick={() => setView(initialView)}>
					Reset view
				</button>
			</div>
		</div>
	);
});
