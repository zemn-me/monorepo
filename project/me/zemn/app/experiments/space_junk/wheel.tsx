import { memo } from 'react';
import { Temporal } from 'temporal-polyfill';

import type { SpaceObject } from './chart.js';
import style from './style.module.css';

function point(date: Temporal.PlainDate, radius: number) {
	const angle = (2 * Math.PI * (date.dayOfYear - 1)) / date.daysInYear;
	return {
		x: Number((radius * Math.sin(angle)).toFixed(3)),
		y: Number((-radius * Math.cos(angle)).toFixed(3)),
	};
}

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

export const Wheel = memo(function Wheel({
	birthday,
	releases = [],
}: {
	birthday?: Temporal.PlainDate;
	releases?: number[];
}) {
	const year = birthday?.year ?? 2019;
	const january = Temporal.PlainDate.from({ year, month: 1, day: 1 });
	const marker = birthday && point(birthday, 136);
	const peak = Math.max(1, ...releases);
	return (
		<svg
			aria-label="Release anniversaries by calendar day, with a star marking your birthday"
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
			<g className={style.spokes}>
				{releases.map((count, i) => {
					if (!count) return null;
					const angle = (360 * i) / releases.length;
					const length = 92 * Math.sqrt(count / peak);
					const date = january
						.add({ days: i })
						.toLocaleString('en-GB', {
							day: 'numeric',
							month: 'long',
						});
					return (
						<line
							key={i}
							transform={`rotate(${angle})`}
							x1="0"
							x2="0"
							y1="-36"
							y2={-36 - length}
						>
							<title>
								{date} · {count.toLocaleString('en-GB')}{' '}
								{count === 1 ? 'object' : 'objects'}
							</title>
						</line>
					);
				})}
			</g>
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
});
