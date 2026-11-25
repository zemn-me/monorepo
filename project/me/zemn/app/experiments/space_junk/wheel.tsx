import { Temporal } from 'temporal-polyfill';

import { objects, type SpaceObject } from './chart.js';
import style from './style.module.css';

function point(date: Temporal.PlainDate, radius: number) {
	const angle = (2 * Math.PI * (date.dayOfYear - 1)) / date.daysInYear;
	return {
		x: Number((radius * Math.sin(angle)).toFixed(3)),
		y: Number((-radius * Math.cos(angle)).toFixed(3)),
	};
}

// The same silhouettes key each catalogue entry to its place on the wheel.
export function ObjectGlyph({ object }: { object: SpaceObject }) {
	const paths = {
		'1976-126V':
			'M-9 -4 1 -9 8 -3 4 6 -4 9Z M-9 -4 0 -1 1 -9 M0 -1 4 6 M0 -1 -4 9',
		'1984-008A':
			'M-4 -4H4V4H-4Z M-11 -3H-6V3H-11Z M6 -3H11V3H6Z M-6 0H-4 M4 0H6 M0 -4V-9 M-3 -9Q0 -5 3 -9',
		'2009-011C':
			'M-4 -7Q0 -10 4 -7V5H-4Z M-4 -5Q0 -3 4 -5 M-4 3H4 M-2 5 -4 9H4L2 5',
	};
	return (
		<svg aria-hidden="true" height="26" viewBox="-13 -13 26 26" width="26">
			<path
				d={paths[object.designator]}
				fill="none"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth="1.35"
				transform="rotate(-23)"
			/>
		</svg>
	);
}

export function Wheel({ birthday }: { birthday?: Temporal.PlainDate }) {
	const year = birthday?.year ?? 2019;
	const january = Temporal.PlainDate.from({ year, month: 1, day: 1 });
	const marker = birthday && point(birthday, 136);
	return (
		<svg
			aria-label="Launch anniversaries on a circular calendar"
			role="img"
			className={style.wheel}
			viewBox="-175 -175 350 350"
		>
			<g fill="none" stroke="currentColor" className={style.grid}>
				<circle r="142" />
				<circle r="132" />
				<circle
					r="137"
					pathLength={january.daysInYear}
					strokeDasharray="0.2 0.8"
					strokeWidth="4"
				/>
				<circle r="111" />
				<circle r="70" />
				{Array.from({ length: 12 }, (_, i) => {
					const start = january.with({ month: i + 1 });
					const edge = point(start, 142);
					const inner = point(start, 31);
					const label = point(start.with({ day: 15 }), 158);
					return (
						<g key={i}>
							<line
								x1={inner.x}
								y1={inner.y}
								x2={edge.x}
								y2={edge.y}
							/>
							<text
								x={label.x}
								y={label.y}
								className={style.month}
								fill="currentColor"
								stroke="none"
								textAnchor="middle"
								dy=".35em"
							>
								{start.toLocaleString('en', { month: 'short' })}
							</text>
						</g>
					);
				})}
			</g>
			<g fill="none" stroke="currentColor" className={style.earth}>
				<circle r="27" />
				<g transform="rotate(-23)">
					<ellipse rx="11" ry="27" />
					<ellipse rx="22" ry="27" />
					<path d="M-27 0H27 M-23 -14Q0 -7 23 -14 M-23 14Q0 21 23 14" />
				</g>
			</g>
			{objects.map(object => {
				const pos = point(object.launched.with({ year }), 111);
				return (
					<g key={object.designator}>
						{marker && (
							<line
								x1={marker.x}
								y1={marker.y}
								x2={pos.x}
								y2={pos.y}
								className={style.aspect}
							/>
						)}
						<g transform={`translate(${pos.x},${pos.y})`}>
							<circle className={style.medallion} r="15" />
							<g transform="translate(-13,-13)">
								<ObjectGlyph object={object} />
							</g>
						</g>
					</g>
				);
			})}
			{marker && (
				<g transform={`translate(${marker.x},${marker.y})`}>
					<path
						className={style.star}
						d="M0 -10 2.8 -2.8 10 0 2.8 2.8 0 10 -2.8 2.8 -10 0 -2.8 -2.8Z"
					/>
				</g>
			)}
		</svg>
	);
}
