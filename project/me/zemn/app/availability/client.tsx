'use client';

import type { CSSProperties, ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { CALENDAR_EMAILS } from '#root/project/me/zemn/app/availability/calendar.js';
import {
	busyEventsForRange,
	CalendarEvent,
	parseICalEvents,
} from '#root/project/me/zemn/app/availability/ical.js';
import style from '#root/project/me/zemn/app/availability/page.module.css';
import { useGetCalendarICals } from '#root/project/me/zemn/hook/useZemnMeApi.js';
import {
	future_and_then,
	future_collect_incremental,
} from '#root/ts/future/future.js';
import { formatDatePartsWithOrdinalDay } from '#root/ts/react/lang/date.js';

const HOUR_HEIGHT_REM = 4;
const HOURS_PER_DAY = 24;
const MINUTES_PER_DAY = HOURS_PER_DAY * 60;
const DAY_VIEW_START_HOUR = 5;
const DAY_VIEW_START_MINUTE = DAY_VIEW_START_HOUR * 60;
const CALENDAR_GRID_ROW_OFFSET = 3;
const VISIBLE_DAY_COUNT = 63;
const RULER_WIDTH_REM = 4.75;
const DAY_COLUMN_MIN_WIDTH_REM = 8;
const RULER_COLUMN = 1;
const FIRST_DAY_COLUMN = 2;
const DAY_COLUMNS = `${FIRST_DAY_COLUMN} / span ${VISIBLE_DAY_COUNT}`;
const FULL_DAY_ROWS = `${CALENDAR_GRID_ROW_OFFSET} / span ${MINUTES_PER_DAY}`;
const CALENDAR_GRID_STYLE = {
	'--hour-height': `${HOUR_HEIGHT_REM}rem`,
	'--minute-height': `${HOUR_HEIGHT_REM / 60}rem`,
	gridTemplateColumns: `minmax(${RULER_WIDTH_REM}rem, max-content) repeat(${VISIBLE_DAY_COUNT}, minmax(var(--availability-day-width), 1fr))`,
	minWidth: `calc(${RULER_WIDTH_REM}rem + ${
		VISIBLE_DAY_COUNT * DAY_COLUMN_MIN_WIDTH_REM
	}rem)`,
} as CSSProperties;

const minuteMarks = (minuteOffset: number) =>
	Array.from(
		{ length: HOURS_PER_DAY },
		(_, hour) => hour * 60 + minuteOffset
	);
const HOUR_MARKS = minuteMarks(0);
const HALF_HOUR_MARKS = minuteMarks(30);

type LocaleList = readonly [string, ...string[]];

interface DayRange {
	readonly endsAt: Temporal.ZonedDateTime;
	readonly key: string;
	readonly dateLabel: ReactElement;
	readonly startsAt: Temporal.ZonedDateTime;
	readonly weekdayLabel: string;
}

interface DayBucket extends DayRange {
	readonly events: readonly CalendarEvent[];
}

function resolvedTimeZone() {
	return Temporal.Now.zonedDateTimeISO().timeZoneId;
}

function resolvedLocales(): LocaleList {
	const primaryLocale =
		Intl.DateTimeFormat().resolvedOptions().locale ||
		navigator.language ||
		'en-US';
	return [
		primaryLocale,
		...navigator.languages.filter(
			locale => locale !== '' && locale !== primaryLocale
		),
	];
}

function weekdayFormatter(locales: LocaleList, timeZone: string) {
	return new Intl.DateTimeFormat(locales, {
		timeZone,
		weekday: 'long',
	});
}

function dateFormatter(locales: LocaleList, timeZone: string) {
	return new Intl.DateTimeFormat(locales, {
		day: 'numeric',
		month: 'long',
		timeZone,
	});
}

function dayKeyFormatter(timeZone: string) {
	return new Intl.DateTimeFormat('en-CA', {
		day: '2-digit',
		month: '2-digit',
		timeZone,
		year: 'numeric',
	});
}

function timeFormatter(locales: LocaleList, timeZone: string) {
	return new Intl.DateTimeFormat(locales, {
		hour: 'numeric',
		minute: '2-digit',
		timeZone,
	});
}

function hourLabels(
	day: Temporal.ZonedDateTime,
	formatTime: Intl.DateTimeFormat
) {
	return HOUR_MARKS.map(minute => ({
		label: formatTime.format(toDate(day.add({ minutes: minute }))),
		minute,
	}));
}

function toZonedDateTime(date: Date, timeZone: string) {
	return Temporal.Instant.fromEpochMilliseconds(
		date.getTime()
	).toZonedDateTimeISO(timeZone);
}

function toDate(date: Temporal.ZonedDateTime) {
	return new globalThis.Date(date.epochMilliseconds);
}

function viewMinuteOfDay(date: Temporal.ZonedDateTime) {
	return (
		(date.hour * 60 +
			date.minute -
			DAY_VIEW_START_MINUTE +
			MINUTES_PER_DAY) %
		MINUTES_PER_DAY
	);
}

function millisecondsUntilNextMinute(date: Temporal.ZonedDateTime) {
	return Math.max(1, (60 - date.second) * 1000 - date.millisecond);
}

function currentDayStart(
	timeZone: string,
	now = Temporal.Now.zonedDateTimeISO(timeZone)
) {
	const zonedNow = now.withTimeZone(timeZone);
	const startsAt = zonedNow.with({
		hour: DAY_VIEW_START_HOUR,
		microsecond: 0,
		millisecond: 0,
		minute: 0,
		nanosecond: 0,
		second: 0,
	});

	return zonedNow.hour * 60 + zonedNow.minute < DAY_VIEW_START_MINUTE
		? startsAt.subtract({ days: 1 })
		: startsAt;
}

function visibleDayRanges(
	start: Temporal.ZonedDateTime,
	locales: LocaleList,
	timeZone: string
): readonly DayRange[] {
	const formatWeekday = weekdayFormatter(locales, timeZone);
	const formatDate = dateFormatter(locales, timeZone);
	const formatKey = dayKeyFormatter(timeZone);
	const localeName =
		Intl.DateTimeFormat.supportedLocalesOf(locales)[0] ?? 'en-US';
	const locale = new Intl.Locale(localeName);

	return Array.from({ length: VISIBLE_DAY_COUNT }, (_, i) => {
		const startsAt = start.add({ days: i });
		const endsAt = startsAt.add({ days: 1 });
		const startsAtDate = toDate(startsAt);

		return {
			dateLabel: formatDatePartsWithOrdinalDay(
				formatDate.formatToParts(startsAtDate),
				locale,
				localeName
			),
			endsAt,
			key: formatKey.format(startsAtDate),
			startsAt,
			weekdayLabel: formatWeekday.format(startsAtDate),
		};
	});
}

function bucketBusyEvents(
	events: readonly CalendarEvent[],
	days: readonly DayRange[]
): readonly DayBucket[] {
	return days.map(day => ({
		...day,
		events: busyEventsForRange(
			events,
			toDate(day.startsAt),
			toDate(day.endsAt)
		),
	}));
}

function timeMarkStyle(
	minute: number,
	gridColumn: CSSProperties['gridColumn'],
	span = 1
) {
	return {
		gridColumn,
		gridRow: `${minute + CALENDAR_GRID_ROW_OFFSET} / span ${span}`,
	};
}

function eventMinuteOfDay(
	date: Date,
	day: DayRange,
	timeZone: string,
	boundary: 'start' | 'end'
) {
	const epochMilliseconds = date.getTime();
	const dayStart = day.startsAt.epochMilliseconds;
	const dayEnd = day.endsAt.epochMilliseconds;
	if (epochMilliseconds <= dayStart) return 0;
	if (epochMilliseconds >= dayEnd) return MINUTES_PER_DAY;

	const minute = viewMinuteOfDay(toZonedDateTime(date, timeZone));
	return boundary === 'end' && minute === 0 ? MINUTES_PER_DAY : minute;
}

function eventStyle(
	column: number,
	event: CalendarEvent,
	day: DayRange,
	timeZone: string
) {
	const startsAtMinute = eventMinuteOfDay(
		event.startsAt,
		day,
		timeZone,
		'start'
	);
	const endsAtMinute = eventMinuteOfDay(event.endsAt, day, timeZone, 'end');
	const startsAtLine = startsAtMinute + CALENDAR_GRID_ROW_OFFSET;

	return {
		gridColumn: column,
		gridRow: `${startsAtLine} / ${Math.max(
			startsAtLine + 1,
			endsAtMinute + CALENDAR_GRID_ROW_OFFSET
		)}`,
	};
}

function BusyEvent({
	column,
	day,
	event,
	formatTime,
	timeZone,
}: {
	readonly column: number;
	readonly day: DayRange;
	readonly event: CalendarEvent;
	readonly formatTime: Intl.DateTimeFormat;
	readonly timeZone: string;
}) {
	return (
		<div
			className={style.busy}
			style={eventStyle(column, event, day, timeZone)}
		>
			{formatTime.format(event.startsAt)} -{' '}
			{formatTime.format(event.endsAt)}
		</div>
	);
}

function CurrentTimeMarker({ minute }: { readonly minute: number }) {
	return (
		<div
			aria-hidden="true"
			className={style.currentTimeMarker}
			style={timeMarkStyle(minute, RULER_COLUMN)}
		/>
	);
}

export function AvailabilityClient() {
	const [locales, setLocales] = useState<LocaleList>(['en-US']);
	const [timeZone, setTimeZone] = useState('UTC');
	const [now, setNow] = useState<Temporal.ZonedDateTime>();
	const calendarBatches = future_collect_incremental(
		useGetCalendarICals(CALENDAR_EMAILS).map(calendar =>
			future_and_then(calendar, parseICalEvents)
		)
	);
	const formatTime = useMemo(
		() => timeFormatter(locales, timeZone),
		[locales, timeZone]
	);
	const start = useMemo(
		() => currentDayStart(timeZone, now),
		[now, timeZone]
	);
	const days = useMemo(
		() => visibleDayRanges(start, locales, timeZone),
		[locales, start, timeZone]
	);
	const events = calendarBatches(
		value => value.flat(),
		() => [],
		() => []
	);
	const calendarLoadFailed = calendarBatches(
		() => false,
		() => false,
		() => true
	);
	const dayBuckets = useMemo(
		() => bucketBusyEvents(events, days),
		[events, days]
	);
	const rulerLabels = useMemo(
		() => (days[0] ? hourLabels(days[0].startsAt, formatTime) : []),
		[days, formatTime]
	);
	const currentTimeMinute = now ? viewMinuteOfDay(now) : undefined;

	useEffect(() => {
		setLocales(resolvedLocales());
		setTimeZone(resolvedTimeZone());
	}, []);

	useEffect(() => {
		let timer: number | undefined;

		const updateNow = () => {
			const nextNow = Temporal.Now.zonedDateTimeISO(timeZone);
			setNow(nextNow);
			timer = window.setTimeout(
				updateNow,
				millisecondsUntilNextMinute(nextNow)
			);
		};

		updateNow();

		return () => {
			if (timer !== undefined) {
				window.clearTimeout(timer);
			}
		};
	}, [timeZone]);

	return (
		<div className={style.page}>
			<header className={style.header}>
				<h1>Thomas' availability</h1>
				<p>Timed blocks below are times I am probably busy.</p>
			</header>
			<div className={style.weekShell}>
				<div className={style.weekScroller}>
					<section
						className={style.week}
						aria-label="Availability calendar"
						style={CALENDAR_GRID_STYLE}
					>
						<div className={style.rulerHeader} aria-hidden="true" />
						{dayBuckets.map((day, index) => (
							<header
								className={style.dayHeader}
								key={day.key}
								style={{
									gridColumn: FIRST_DAY_COLUMN + index,
									gridRow: '1 / 3',
								}}
							>
								<span>{day.weekdayLabel}</span>
								<span className={style.dayHeaderDate}>
									{day.dateLabel}
								</span>
							</header>
						))}
						<div
							className={style.rulerLane}
							aria-hidden="true"
							style={{
								gridColumn: RULER_COLUMN,
								gridRow: FULL_DAY_ROWS,
							}}
						/>
						{dayBuckets.map((day, index) => (
							<div
								className={style.dayLane}
								aria-hidden="true"
								key={`${day.key}-lane`}
								style={{
									gridColumn: FIRST_DAY_COLUMN + index,
									gridRow: FULL_DAY_ROWS,
								}}
							/>
						))}
						{HOUR_MARKS.map(minute => (
							<div
								className={style.dayHourLine}
								aria-hidden="true"
								key={`h${minute}`}
								style={timeMarkStyle(minute, DAY_COLUMNS)}
							/>
						))}
						{HALF_HOUR_MARKS.map(minute => (
							<div
								className={style.dayHalfHourLine}
								aria-hidden="true"
								key={`m${minute}`}
								style={timeMarkStyle(minute, DAY_COLUMNS)}
							/>
						))}
						{HALF_HOUR_MARKS.map(minute => (
							<div
								className={style.rulerHalfHourTick}
								aria-hidden="true"
								key={`t${minute}`}
								style={timeMarkStyle(minute, RULER_COLUMN)}
							/>
						))}
						{rulerLabels.map(({ label, minute }) => (
							<div
								className={style.rulerLabel}
								key={minute}
								style={timeMarkStyle(minute, RULER_COLUMN, 60)}
							>
								{label}
							</div>
						))}
						{currentTimeMinute === undefined ? null : (
							<CurrentTimeMarker minute={currentTimeMinute} />
						)}
						{dayBuckets.map((day, index) =>
							day.events.map((event, i) => (
								<BusyEvent
									column={FIRST_DAY_COLUMN + index}
									day={day}
									event={event}
									formatTime={formatTime}
									key={`${day.key}-${event.startsAt.toISOString()}-${i}`}
									timeZone={timeZone}
								/>
							))
						)}
					</section>
				</div>
			</div>
			{calendarLoadFailed ? (
				<p className={style.error}>
					One or more calendar feeds could not be loaded.
				</p>
			) : null}
		</div>
	);
}
