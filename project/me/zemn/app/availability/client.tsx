'use client';

import {
	CSSProperties,
	ReactElement,
	useEffect,
	useMemo,
	useState,
} from 'react';
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
const DAYS_PER_WEEK = 7;
const MINUTES_PER_DAY = HOURS_PER_DAY * 60;
const DAY_VIEW_START_HOUR = 5;
const DAY_VIEW_START_MINUTE = DAY_VIEW_START_HOUR * 60;
const CALENDAR_GRID_ROW_OFFSET = 3;
const VISIBLE_DAY_COUNT = 63;
const DAY_COLUMN_MIN_WIDTH_REM = 8;

const hourMarks = Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
	hour,
	minute: hour * 60,
}));
const halfHourMarks = Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
	hour,
	minute: hour * 60 + 30,
}));

type LocaleList = readonly [string, ...string[]];

interface DayBucket {
	readonly endsAt: Temporal.ZonedDateTime;
	readonly events: readonly CalendarEvent[];
	readonly key: string;
	readonly dateLabel: ReactElement;
	readonly startsAt: Temporal.ZonedDateTime;
	readonly weekdayLabel: string;
}

function resolvedTimeZone() {
	return (
		Intl.DateTimeFormat().resolvedOptions().timeZone ??
		Temporal.Now.zonedDateTimeISO().timeZoneId
	);
}

function resolvedLocales(): LocaleList {
	const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
	const locales = [
		intlLocale,
		...navigator.languages.filter(locale => locale !== intlLocale),
	].filter(locale => locale !== '');

	const first = locales[0];
	if (first !== undefined) {
		return [first, ...locales.slice(1)];
	}

	if (navigator.languages.length > 0) {
		return navigator.languages as LocaleList;
	}

	return [navigator.language || 'en-US'];
}

function firstDayOfWeek(locale: string) {
	type WeekInfoLocale = Intl.Locale & {
		readonly weekInfo?: { readonly firstDay?: number };
	};

	const firstDay = (new Intl.Locale(locale) as WeekInfoLocale).weekInfo
		?.firstDay;

	return typeof firstDay === 'number' ? firstDay % 7 : 1;
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
	return Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
		hour,
		label: formatTime.format(zonedDateTimeToDate(addZonedHours(day, hour))),
	}));
}

function dateToZonedDateTime(date: Date, timeZone: string) {
	return Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timeZone);
}

function zonedDateTimeToDate(date: Temporal.ZonedDateTime) {
	return new globalThis.Date(date.epochMilliseconds);
}

function wallMinuteOfDay(date: Temporal.ZonedDateTime) {
	return date.hour * 60 + date.minute;
}

function viewMinuteOfDay(date: Temporal.ZonedDateTime) {
	return (
		(wallMinuteOfDay(date) - DAY_VIEW_START_MINUTE + MINUTES_PER_DAY) %
		MINUTES_PER_DAY
	);
}

function millisecondsUntilNextMinute(date: Temporal.ZonedDateTime) {
	return Math.max(
		1,
		(60 - date.second) * 1000 - date.millisecond
	);
}

function weekStart(
	timeZone: string,
	locale: string,
	now = Temporal.Now.zonedDateTimeISO(timeZone)
) {
	const weekday = now.dayOfWeek % 7;
	const dayOffset =
		(weekday - firstDayOfWeek(locale) + DAYS_PER_WEEK) % DAYS_PER_WEEK;

	return now.subtract({ days: dayOffset }).with({
		hour: DAY_VIEW_START_HOUR,
		microsecond: 0,
		millisecond: 0,
		minute: 0,
		nanosecond: 0,
		second: 0,
	});
}

function addZonedHours(day: Temporal.ZonedDateTime, hours: number) {
	return day.add({ hours });
}

function addZonedDays(day: Temporal.ZonedDateTime, days: number) {
	return day.add({ days });
}

function visibleDayRanges(
	start: Temporal.ZonedDateTime,
	locales: LocaleList,
	timeZone: string,
	dayCount: number
) {
	const formatWeekday = weekdayFormatter(locales, timeZone);
	const formatDate = dateFormatter(locales, timeZone);
	const formatKey = dayKeyFormatter(timeZone);
	const localeName =
		Intl.DateTimeFormat.supportedLocalesOf(locales)[0] ?? 'en-US';
	const locale = new Intl.Locale(localeName);

	return Array.from({ length: dayCount }, (_, i) => {
		const startsAt = addZonedDays(start, i);
		const endsAt = addZonedDays(startsAt, 1);
		const startsAtDate = zonedDateTimeToDate(startsAt);

		return {
			dateLabel: formatDatePartsWithOrdinalDay(
				formatDate.formatToParts(startsAtDate),
				locale,
				localeName
			),
			endsAt,
			events: [],
			key: formatKey.format(startsAtDate),
			startsAt,
			weekdayLabel: formatWeekday.format(startsAtDate),
		};
	});
}

function bucketBusyEvents(
	events: readonly CalendarEvent[],
	days: readonly Omit<DayBucket, 'events'>[]
): readonly DayBucket[] {
	return days.map(day => ({
		...day,
		events: busyEventsForRange(
			events,
			zonedDateTimeToDate(day.startsAt),
			zonedDateTimeToDate(day.endsAt)
		),
	}));
}

function gridStyle(dayCount: number): CSSProperties {
	return {
		'--hour-height': `${HOUR_HEIGHT_REM}rem`,
		'--minute-height': `${HOUR_HEIGHT_REM / 60}rem`,
		gridTemplateColumns: `minmax(4.75rem, max-content) repeat(${dayCount}, minmax(var(--availability-day-width), 1fr))`,
		minWidth: `calc(4.75rem + ${dayCount * DAY_COLUMN_MIN_WIDTH_REM}rem)`,
	} as CSSProperties;
}

function timeMarkStyle(
	minute: number,
	gridColumn: CSSProperties['gridColumn']
) {
	return {
		gridColumn,
		gridRow: `${minute + CALENDAR_GRID_ROW_OFFSET} / span 1`,
	};
}

function eventMinuteOfDay(
	date: Date,
	day: Temporal.ZonedDateTime,
	timeZone: string,
	boundary: 'start' | 'end'
) {
	const dayStart = day.epochMilliseconds;
	const dayEnd = addZonedDays(day, 1).epochMilliseconds;
	if (date.getTime() <= dayStart) return 0;
	if (date.getTime() >= dayEnd) return MINUTES_PER_DAY;

	const minute = viewMinuteOfDay(dateToZonedDateTime(date, timeZone));
	return boundary === 'end' && minute === 0 ? MINUTES_PER_DAY : minute;
}

function eventStyle(
	column: number,
	event: CalendarEvent,
	day: Temporal.ZonedDateTime,
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
	readonly day: Temporal.ZonedDateTime;
	readonly event: CalendarEvent;
	readonly formatTime: Intl.DateTimeFormat;
	readonly timeZone: string;
}) {
	return (
		<div
			className={style.busy}
			data-availability-busy
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
			data-availability-current-time-marker
			data-availability-current-minute={minute}
			style={{
				gridColumn: 1,
				gridRow: `${minute + CALENDAR_GRID_ROW_OFFSET} / span 1`,
			}}
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
	const locale = locales[0];
	const formatTime = useMemo(
		() => timeFormatter(locales, timeZone),
		[locales, timeZone]
	);
	const start = useMemo(
		() => weekStart(timeZone, locale),
		[locale, timeZone]
	);
	const days = useMemo(
		() => visibleDayRanges(start, locales, timeZone, VISIBLE_DAY_COUNT),
		[locales, start, timeZone]
	);
	const rangeEnd = useMemo(
		() => addZonedDays(start, VISIBLE_DAY_COUNT),
		[start]
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
	const busyEvents = busyEventsForRange(
		events,
		zonedDateTimeToDate(start),
		zonedDateTimeToDate(rangeEnd)
	);
	const dayBuckets = useMemo(
		() => bucketBusyEvents(busyEvents, days),
		[busyEvents, days]
	);
	const rulerLabels = useMemo(
		() =>
			days[0] ? hourLabels(days[0].startsAt, formatTime) : [],
		[days, formatTime]
	);
	const calendarGridStyle = useMemo(() => gridStyle(VISIBLE_DAY_COUNT), []);
	const currentTimeMinute = useMemo(
		() => (now ? viewMinuteOfDay(now) : undefined),
		[now]
	);

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
				<div
					className={style.weekScroller}
					data-availability-week-scroller
				>
					<section
						className={style.week}
						aria-label="Availability calendar"
						style={calendarGridStyle}
					>
						<div
							className={style.rulerHeader}
							aria-hidden="true"
							data-availability-ruler-header
						/>
						{dayBuckets.map((day, index) => (
							<header
								className={style.dayHeader}
								data-availability-day-header
								key={day.key}
								style={{
									gridColumn: index + 2,
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
							data-availability-ruler-lane
							style={{
								gridColumn: 1,
								gridRow: `${CALENDAR_GRID_ROW_OFFSET} / span ${MINUTES_PER_DAY}`,
							}}
						/>
						{dayBuckets.map((day, index) => (
							<div
								className={style.dayLane}
								aria-hidden="true"
								data-availability-day-lane
								key={`${day.key}-lane`}
								style={{
									gridColumn: index + 2,
									gridRow: `${CALENDAR_GRID_ROW_OFFSET} / span ${MINUTES_PER_DAY}`,
								}}
							/>
						))}
						{hourMarks.map(({ hour, minute }) => (
							<div
								className={style.dayHourLine}
								aria-hidden="true"
								data-availability-day-hour-line
								key={`day-hour-line-${hour}`}
								style={timeMarkStyle(
									minute,
									`2 / span ${VISIBLE_DAY_COUNT}`
								)}
							/>
						))}
						{halfHourMarks.map(({ hour, minute }) => (
							<div
								className={style.dayHalfHourLine}
								aria-hidden="true"
								data-availability-day-half-hour-line
								key={`day-half-hour-line-${hour}`}
								style={timeMarkStyle(
									minute,
									`2 / span ${VISIBLE_DAY_COUNT}`
								)}
							/>
						))}
						{halfHourMarks.map(({ hour, minute }) => (
							<div
								className={style.rulerHalfHourTick}
								aria-hidden="true"
								data-availability-ruler-half-hour-tick
								key={`ruler-half-hour-tick-${hour}`}
								style={timeMarkStyle(minute, 1)}
							/>
						))}
						{rulerLabels.map(({ hour, label }) => (
							<div
								className={style.rulerLabel}
								data-availability-ruler-label
								key={hour}
								style={{
									gridColumn: 1,
									gridRow: `${
										hour * 60 + CALENDAR_GRID_ROW_OFFSET
									} / span 60`,
								}}
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
									column={index + 2}
									day={day.startsAt}
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
