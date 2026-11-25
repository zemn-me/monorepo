import { useMemo, useRef, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { useLocale } from '#root/ts/react/lang/useLocale.js';
import style from './style.module.css';

interface Scale {
	label: string;
	min: number;
	max: number;
	value: number;
	pixelsPerUnit: number;
	tick: number;
	major: number;
	format: (value: number) => string;
	tickLabel?: (value: number) => string;
	onChange: (value: number) => void;
}

function Ruler({
	label,
	min,
	max,
	value,
	pixelsPerUnit,
	tick,
	major,
	format,
	tickLabel = format,
	onChange,
}: Scale) {
	const input = useRef<HTMLInputElement>(null);
	const drag = useRef<{
		id: number;
		x: number;
		value: number;
		moved: boolean;
	} | null>(null);
	const [position, setPosition] = useState<number>();
	const centre = position ?? value;
	const clamp = (n: number) => Math.max(min, Math.min(max, n));
	// The page is at most 46rem wide. Only engrave the strip around the cursor.
	const radius = 430 / pixelsPerUnit;
	const ticks = [];
	const firstTick = Math.ceil(Math.max(min, centre - radius) / tick) * tick;
	const lastTick = Math.min(max, centre + radius);
	for (let n = firstTick; n <= lastTick; n += tick) {
		const majorTick = n % major === 0 || n === min;
		const x = (n - centre) * pixelsPerUnit;
		ticks.push(
			<g key={n} transform={`translate(${x} 0)`}>
				<path d={majorTick ? 'M0 23v11' : 'M0 28v6'} />
				{majorTick && <text y="17">{tickLabel(n)}</text>}
			</g>
		);
	}

	return (
		<div className={style.rulerRow}>
			<div aria-hidden="true" className={style.rulerValue}>
				<span>{label}</span>
				<strong>{format(value)}</strong>
			</div>
			<div
				className={style.rulerTrack}
				onPointerDown={e => {
					if (!e.isPrimary || e.button !== 0) return;
					e.preventDefault();
					input.current?.focus({ preventScroll: true });
					e.currentTarget.setPointerCapture(e.pointerId);
					drag.current = {
						id: e.pointerId,
						x: e.clientX,
						value,
						moved: false,
					};
				}}
				onPointerMove={e => {
					const start = drag.current;
					if (!start || start.id !== e.pointerId) return;
					const dx = e.clientX - start.x;
					if (!start.moved && Math.abs(dx) < 3) return;
					start.moved = true;
					const next = clamp(start.value - dx / pixelsPerUnit);
					setPosition(next);
					onChange(Math.round(next));
				}}
				onPointerUp={e => {
					const start = drag.current;
					if (!start || start.id !== e.pointerId) return;
					if (!start.moved) {
						const box = e.currentTarget.getBoundingClientRect();
						const offset = e.clientX - box.left - box.width / 2;
						onChange(
							clamp(
								Math.round(start.value + offset / pixelsPerUnit)
							)
						);
					}
				}}
				onLostPointerCapture={() => {
					drag.current = null;
					setPosition(undefined);
				}}
			>
				<input
					ref={input}
					type="range"
					name={label.split(' ')[0]!.toLowerCase()}
					aria-label={label}
					aria-valuetext={format(value)}
					min={min}
					max={max}
					step={1}
					value={value}
					onChange={e => onChange(e.currentTarget.valueAsNumber)}
					onKeyDown={e => {
						if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
						e.preventDefault();
						onChange(
							clamp(value + (e.key === 'PageUp' ? major : -major))
						);
					}}
				/>
				<svg aria-hidden="true" width="100%" height="44">
					<svg x="50%" width="1" height="44" overflow="visible">
						{ticks}
					</svg>
				</svg>
				<i aria-hidden="true" />
			</div>
		</div>
	);
}

export function BirthdayRulers({
	value,
	asOf,
	onChange,
}: {
	value: Temporal.PlainDateTime;
	asOf: Temporal.PlainDate;
	onChange: (value: Temporal.PlainDateTime) => void;
}) {
	const languages = useLocale();
	const numbers = useMemo(
		() => new Intl.NumberFormat(languages, { useGrouping: false }),
		[languages]
	);
	const months = useMemo(
		() =>
			Array.from({ length: 12 }, (_, i) => {
				const date = Temporal.PlainDate.from({
					year: 2000,
					month: i + 1,
					day: 1,
				});
				return {
					short: date.toLocaleString(languages, { month: 'short' }),
					long: date.toLocaleString(languages, { month: 'long' }),
				};
			}),
		[languages]
	);
	function change(fields: Parameters<typeof value.with>[0]) {
		let next = value.with(fields, { overflow: 'constrain' });
		if (Temporal.PlainDate.compare(next, asOf) > 0)
			next = asOf.toPlainDateTime(next.toPlainTime());
		if (!next.equals(value)) onChange(next);
	}
	return (
		<fieldset className={style.rulers} aria-label="Chart date and time">
			<Ruler
				label="Year"
				min={1}
				max={asOf.year}
				value={value.year}
				pixelsPerUnit={13}
				tick={1}
				major={5}
				format={numbers.format}
				onChange={year => change({ year })}
			/>
			<Ruler
				label="Month"
				min={1}
				max={value.year === asOf.year ? asOf.month : 12}
				value={value.month}
				pixelsPerUnit={56}
				tick={1}
				major={1}
				format={m => months[m - 1]!.long}
				tickLabel={m => months[m - 1]!.short}
				onChange={month => change({ month })}
			/>
			<Ruler
				label="Day"
				min={1}
				max={
					value.year === asOf.year && value.month === asOf.month
						? asOf.day
						: value.daysInMonth
				}
				value={value.day}
				pixelsPerUnit={15}
				tick={1}
				major={5}
				format={numbers.format}
				onChange={day => change({ day })}
			/>
			<Ruler
				label="Time (UTC)"
				min={0}
				max={1439}
				value={value.hour * 60 + value.minute}
				pixelsPerUnit={1.1}
				tick={5}
				major={60}
				format={minutes =>
					Temporal.PlainTime.from({
						hour: Math.floor(minutes / 60),
						minute: minutes % 60,
					}).toString({ smallestUnit: 'minute' })
				}
				onChange={minutes =>
					change({
						hour: Math.floor(minutes / 60),
						minute: minutes % 60,
					})
				}
			/>
		</fieldset>
	);
}
