import { memo, useMemo } from 'react';
import { useLocale } from '#root/ts/react/lang/useLocale.js';
import {
	dayMs,
	firstInstant,
	instantAtPosition,
	minuteMs,
	type RulerUnit,
	rulerPosition,
	zonedTime,
} from './ruler_time.js';
import { SlideRule } from './slide_rule.js';
import style from './style.module.css';
import type { RulerClock, TimeScale } from './use_ruler_clock.js';

const scales = {
	year: { label: 'Year', pitch: 72, tick: 1 / 12, major: 1, page: 5 },
	month: { label: 'Month', pitch: 64, tick: 0.25, major: 1, page: 3 },
	day: { label: 'Day', pitch: 40, tick: 0.25, major: 1, page: 7 },
	minute: { label: 'Time', pitch: 1.1, tick: 5, major: 60, page: 60 },
} as const;

function Ruler({
	unit,
	epoch,
	lastInstant,
	readout,
	accessibleTime,
	tickLabel,
	zone,
	tickOrigin = 0,
	zoneName,
	clock,
}: {
	unit: RulerUnit;
	epoch: number;
	lastInstant: number;
	readout: string;
	accessibleTime: string;
	tickLabel: (tick: number) => string;
	zone: string;
	tickOrigin?: number;
	zoneName?: string;
	clock: RulerClock;
}) {
	const { label, pitch, tick, major, page } = scales[unit];
	const scale = useMemo<TimeScale>(() => {
		const position = (time: number) => rulerPosition(unit, time, zone);
		const min = position(firstInstant);
		const max = position(lastInstant);
		return {
			min,
			max,
			position,
			instant: mark => {
				if (mark <= min) return firstInstant;
				if (mark >= max) return lastInstant;
				return instantAtPosition(unit, mark, zone);
			},
		};
	}, [unit, lastInstant, zone]);
	return (
		<SlideRule
			label={label}
			caption={zoneName ? label + ' (' + zoneName + ')' : undefined}
			readout={readout}
			centre={scale.position(epoch)}
			min={scale.min}
			max={scale.max}
			pitch={pitch}
			tick={tick}
			major={major}
			tickOrigin={tickOrigin}
			tickLabel={tickLabel}
			readPosition={() => clock.position(scale)}
			seek={mark => clock.seek(mark, scale)}
			inputProps={{
				name: unit === 'minute' ? 'time' : unit,
				'aria-valuetext': accessibleTime,
				min: firstInstant,
				max: lastInstant,
				step: 1,
				value: epoch,
				onChange: e => clock.seek(e.currentTarget.valueAsNumber),
				onKeyDown: e => {
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
					if (unit === 'day') {
						const time = zonedTime(clock.read(), zone).add({
							days: increment,
						}).epochMilliseconds;
						clock.seek(
							Math.max(firstInstant, Math.min(lastInstant, time))
						);
					} else {
						clock.seek(clock.position(scale) + increment, scale);
					}
				},
			}}
		/>
	);
}

export const BirthdayRulers = memo(function BirthdayRulers({
	epoch,
	asOf,
	zone: localZone,
	clock,
}: {
	epoch: number;
	asOf: string;
	zone?: string;
	clock: RulerClock;
}) {
	const languages = useLocale();
	// The server and browser can abbreviate the same month differently.
	// Use numeric UTC labels for the shared first render, then localize them.
	const zone = localZone ?? 'UTC';
	const formats = useMemo(() => {
		if (!localZone) return;
		const monthFormat = (month: 'short' | 'long') =>
			new Intl.DateTimeFormat(languages, {
				calendar: 'gregory',
				month,
				timeZone: 'UTC',
			});
		const short = monthFormat('short'),
			long = monthFormat('long');
		return {
			number: new Intl.NumberFormat(languages, { useGrouping: false })
				.format,
			months: Array.from({ length: 12 }, (_, index) => {
				const date = Date.UTC(2000, index, 1);
				return { short: short.format(date), long: long.format(date) };
			}),
			zone: new Intl.DateTimeFormat(languages, {
				timeZone: localZone,
				timeZoneName: 'short',
			}),
			time: new Intl.DateTimeFormat(languages, {
				timeZone: localZone,
				hourCycle: 'h23',
				hour: '2-digit',
				minute: '2-digit',
			}),
			date: new Intl.DateTimeFormat(languages, {
				calendar: 'gregory',
				dateStyle: 'long',
				timeZone: localZone,
			}),
		};
	}, [languages, localZone]);
	const number = formats?.number ?? String;
	const date = zonedTime(epoch, zone);
	const localTime = date.toPlainTime().toString({ smallestUnit: 'second' });
	const zoneName =
		formats?.zone
			.formatToParts(epoch)
			.find(part => part.type === 'timeZoneName')?.value ?? zone;
	const dateLabel = formats?.date.format(epoch) ?? date.toPlainDate().toString();
	const common = {
		epoch,
		lastInstant: Date.parse(asOf + 'T23:59:59.999Z'),
		accessibleTime:
			dateLabel +
			' · ' +
			localTime +
			' ' +
			zoneName,
		zone,
		clock,
	};
	return (
		<fieldset className={style.rulers} aria-label="Chart date and time">
			<Ruler
				{...common}
				unit="year"
				readout={number(date.year)}
				tickLabel={number}
			/>
			<Ruler
				{...common}
				unit="month"
				readout={
					formats?.months[date.month - 1]?.long ?? String(date.month)
				}
				tickLabel={mark =>
					formats?.months[mark % 12]?.short ?? String((mark % 12) + 1)
				}
			/>
			<Ruler
				{...common}
				unit="day"
				readout={number(date.day)}
				tickLabel={mark => number(new Date(mark * dayMs).getUTCDate())}
			/>
			<Ruler
				{...common}
				unit="minute"
				readout={localTime}
				zoneName={zoneName}
				tickOrigin={-(date.offsetNanoseconds / 60e9) % 60}
				tickLabel={mark =>
					formats?.time.format(mark * minuteMs) ??
					new Date(mark * minuteMs).toISOString().slice(11, 16)
				}
			/>
		</fieldset>
	);
});
