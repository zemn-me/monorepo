import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useMemo,
	useRef,
} from 'react';
import { useLocale } from '#root/ts/react/lang/useLocale.js';
import {
	dayMs,
	firstInstant,
	instantAtPosition,
	minuteMs,
	rulerPosition,
	type RulerUnit,
} from './ruler_time.js';
import style from './style.module.css';

const scales = {
	year: { label: 'Year', pitch: 72, tick: 1 / 12, major: 1, page: 5 },
	month: { label: 'Month', pitch: 64, tick: 0.25, major: 1, page: 3 },
	day: { label: 'Day', pitch: 40, tick: 0.25, major: 1, page: 7 },
	minute: { label: 'Time (UTC)', pitch: 1.1, tick: 5, major: 60, page: 60 },
} as const;
type ChangeInstant = Dispatch<SetStateAction<number>>;

function Ruler({
	unit,
	epoch,
	lastInstant,
	readout,
	accessibleTime,
	tickLabel,
	onChange,
}: {
	unit: RulerUnit;
	epoch: number;
	lastInstant: number;
	readout: string;
	accessibleTime: string;
	tickLabel: (tick: number) => string;
	onChange: ChangeInstant;
}) {
	const { label, pitch, tick, major, page } = scales[unit];
	const centre = rulerPosition(unit, epoch);
	const limits = useMemo(
		() => ({
			min: rulerPosition(unit, firstInstant),
			max: rulerPosition(unit, lastInstant),
		}),
		[unit, lastInstant]
	);
	const at = useMemo(
		() => (position: number) => {
			if (position <= limits.min) return firstInstant;
			if (position >= limits.max) return lastInstant;
			return instantAtPosition(unit, position);
		},
		[limits, unit, lastInstant]
	);
	const input = useRef<HTMLInputElement>(null);
	const track = useRef<HTMLDivElement>(null);
	const drag = useRef<{
		id: number;
		x: number;
		origin: number;
		moved: boolean;
		mark?: number;
	} | null>(null);
	useEffect(() => {
		const strip = track.current!;
		const scroll = (event: WheelEvent) => {
			if (event.ctrlKey || !event.cancelable) return;
			const delta =
				Math.abs(event.deltaX) > Math.abs(event.deltaY)
					? event.deltaX
					: event.deltaY;
			if (!delta) return;
			event.preventDefault();
			const pixels =
				event.deltaMode === WheelEvent.DOM_DELTA_LINE
					? 16
					: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
						? strip.clientWidth
						: 1;
			onChange(current =>
				at(rulerPosition(unit, current) + (delta * pixels) / pitch)
			);
		};
		strip.addEventListener('wheel', scroll, { passive: false });
		return () => strip.removeEventListener('wheel', scroll);
	}, [at, unit, pitch, onChange]);

	const ticks = [];
	const radius = 430 / pitch;
	// An integer tick index avoids drift at twelfths of a year.
	const first = Math.ceil(Math.max(limits.min, centre - radius) / tick);
	const last = Math.floor(Math.min(limits.max, centre + radius) / tick);
	for (let i = first; i <= last; i++) {
		const mark = i * tick;
		const labelled = i % Math.round(major / tick) === 0;
		ticks.push(
			<g
				key={i}
				transform={`translate(${(mark - centre) * pitch} 0)`}
				data-position={mark}
			>
				<path d={labelled ? 'M0 23v11' : 'M0 28v6'} />
				{labelled && (
					<>
						<rect
							x="-16"
							width="32"
							height="20"
							fill="transparent"
						/>
						<text y="17">{tickLabel(mark)}</text>
					</>
				)}
			</g>
		);
	}

	return (
		<div className={style.rulerRow}>
			<div className={style.rulerValue} aria-hidden="true">
				<span>{label}</span>
				<strong>{readout}</strong>
			</div>
			<div
				ref={track}
				className={style.rulerTrack}
				onPointerDown={e => {
					if (!e.isPrimary || e.button !== 0) return;
					e.preventDefault();
					input.current?.focus({ preventScroll: true });
					const tick = (e.target as Element)
						.closest('g[data-position]')
						?.getAttribute('data-position');
					drag.current = {
						id: e.pointerId,
						x: e.clientX,
						origin: centre,
						moved: false,
						mark: tick == null ? undefined : Number(tick),
					};
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={e => {
					const start = drag.current;
					if (!start || start.id !== e.pointerId) return;
					const dx = e.clientX - start.x;
					const threshold = e.pointerType === 'touch' ? 3 : 0.5;
					if (!start.moved && Math.abs(dx) < threshold) return;
					start.moved = true;
					onChange(at(start.origin - dx / pitch));
				}}
				onPointerUp={e => {
					const start = drag.current;
					if (!start || start.id !== e.pointerId) return;
					if (start.moved) {
						onChange(
							at(start.origin - (e.clientX - start.x) / pitch)
						);
					} else {
						const box = e.currentTarget.getBoundingClientRect();
						const offset = e.clientX - box.left - box.width / 2;
						onChange(
							at(start.mark ?? start.origin + offset / pitch)
						);
					}
				}}
				onLostPointerCapture={() => {
					drag.current = null;
				}}
			>
				<input
					type="range"
					ref={input}
					name={unit === 'minute' ? 'time' : unit}
					aria-label={label}
					aria-valuetext={accessibleTime}
					min={firstInstant}
					max={lastInstant}
					step="1"
					value={epoch}
					onChange={e => onChange(e.currentTarget.valueAsNumber)}
					onKeyDown={e => {
						const increments: Record<string, number> = {
							ArrowRight: 1,
							ArrowUp: 1,
							ArrowLeft: -1,
							ArrowDown: -1,
							PageUp: page,
							PageDown: -page,
						};
						const increment = increments[e.key];
						if (increment === undefined) return;
						e.preventDefault();
						onChange(current =>
							at(rulerPosition(unit, current) + increment)
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
	epoch,
	asOf,
	onChange,
}: {
	epoch: number;
	asOf: string;
	onChange: ChangeInstant;
}) {
	const languages = useLocale();
	const numbers = useMemo(
		() => new Intl.NumberFormat(languages, { useGrouping: false }),
		[languages]
	);
	const months = useMemo(() => {
		const formatter = (month: 'short' | 'long') =>
			new Intl.DateTimeFormat(languages, {
				calendar: 'gregory',
				month,
				timeZone: 'UTC',
			});
		const short = formatter('short'),
			long = formatter('long');
		return Array.from({ length: 12 }, (_, index) => {
			const date = Date.UTC(2000, index, 1);
			return { short: short.format(date), long: long.format(date) };
		});
	}, [languages]);
	const date = new Date(epoch);
	const clock = date.toISOString().slice(11, 19);
	const fullDate = useMemo(
		() =>
			new Intl.DateTimeFormat(languages, {
				calendar: 'gregory',
				dateStyle: 'long',
				timeZone: 'UTC',
			}),
		[languages]
	);
	const common = {
		epoch,
		lastInstant: Date.parse(asOf + 'T23:59:59.999Z'),
		accessibleTime: fullDate.format(date) + ' · ' + clock + ' UTC',
		onChange,
	};
	return (
		<fieldset className={style.rulers} aria-label="Chart date and time">
			<Ruler
				{...common}
				unit="year"
				readout={numbers.format(date.getUTCFullYear())}
				tickLabel={numbers.format}
			/>
			<Ruler
				{...common}
				unit="month"
				readout={months[date.getUTCMonth()]!.long}
				tickLabel={mark => months[mark % 12]!.short}
			/>
			<Ruler
				{...common}
				unit="day"
				readout={numbers.format(date.getUTCDate())}
				tickLabel={mark =>
					numbers.format(new Date(mark * dayMs).getUTCDate())
				}
			/>
			<Ruler
				{...common}
				unit="minute"
				readout={clock}
				tickLabel={mark =>
					new Date(mark * minuteMs).toISOString().slice(11, 16)
				}
			/>
		</fieldset>
	);
}
