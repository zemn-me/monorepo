'use client';

import {
	CSSProperties,
	ReactElement,
	useEffect,
	useMemo,
	useState,
} from 'react';

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

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type LocaleList = readonly [string, ...string[]];

interface DayBucket {
	readonly endsAt: Date;
	readonly events: readonly CalendarEvent[];
	readonly key: string;
	readonly label: ReactElement;
	readonly startsAt: Date;
}

function resolvedTimeZone() {
	return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

function resolvedLocales(): LocaleList {
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

function dayFormatter(locales: LocaleList, timeZone: string) {
	return new Intl.DateTimeFormat(locales, {
		day: 'numeric',
		month: 'short',
		timeZone,
		weekday: 'short',
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
	day: Date,
	formatTime: Intl.DateTimeFormat,
	timeZone: string
) {
	return Array.from({ length: HOURS_PER_DAY }, (_, hour) => ({
		hour,
		label: formatTime.format(dayAtHour(day, hour, timeZone)),
	}));
}

function zonedDateFormatter(timeZone: string) {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		hour: '2-digit',
		hour12: false,
		hourCycle: 'h23',
		minute: '2-digit',
		month: '2-digit',
		second: '2-digit',
		timeZone,
		weekday: 'short',
		year: 'numeric',
	});
}

function zonedParts(date: Date, timeZone: string) {
	const parts = new Map(
		zonedDateFormatter(timeZone)
			.formatToParts(date)
			.map(part => [part.type, part.value])
	);

	return {
		day: Number(parts.get('day')),
		hour: Number(parts.get('hour')) % 24,
		minute: Number(parts.get('minute')),
		month: Number(parts.get('month')),
		second: Number(parts.get('second')),
		weekday: weekdays.indexOf(
			parts.get('weekday') as (typeof weekdays)[number]
		),
		year: Number(parts.get('year')),
	};
}

function timeZoneOffset(date: Date, timeZone: string) {
	const parts = zonedParts(date, timeZone);
	return (
		Date.UTC(
			parts.year,
			parts.month - 1,
			parts.day,
			parts.hour,
			parts.minute,
			parts.second
		) - date.getTime()
	);
}

function zonedDate(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	timeZone: string
) {
	const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
	return new Date(utcGuess.getTime() - timeZoneOffset(utcGuess, timeZone));
}

function weekStart(timeZone: string, locale: string, now = new Date()) {
	const parts = zonedParts(now, timeZone);
	const dayOffset =
		(parts.weekday - firstDayOfWeek(locale) + weekdays.length) %
		weekdays.length;

	return zonedDate(
		parts.year,
		parts.month,
		parts.day - dayOffset,
		0,
		0,
		timeZone
	);
}

function dayAtHour(day: Date, hour: number, timeZone: string) {
	const parts = zonedParts(day, timeZone);
	return zonedDate(parts.year, parts.month, parts.day, hour, 0, timeZone);
}

function addZonedDays(day: Date, days: number, timeZone: string) {
	const parts = zonedParts(day, timeZone);
	return zonedDate(
		parts.year,
		parts.month,
		parts.day + days,
		0,
		0,
		timeZone
	);
}

function visibleDayRanges(
	start: Date,
	locales: LocaleList,
	timeZone: string
) {
	const formatDay = dayFormatter(locales, timeZone);
	const formatKey = dayKeyFormatter(timeZone);
	const localeName =
		Intl.DateTimeFormat.supportedLocalesOf(locales)[0] ?? 'en-US';
	const locale = new Intl.Locale(localeName);

	return Array.from({ length: 7 }, (_, i) => {
		const startsAt = addZonedDays(start, i, timeZone);
		const endsAt = addZonedDays(startsAt, 1, timeZone);

		return {
			endsAt,
			events: [],
			key: formatKey.format(startsAt),
			label: formatDatePartsWithOrdinalDay(
				formatDay.formatToParts(startsAt),
				locale,
				localeName
			),
			startsAt,
		};
	});
}

function bucketBusyEvents(
	events: readonly CalendarEvent[],
	days: readonly Omit<DayBucket, 'events'>[]
): readonly DayBucket[] {
	return days.map(day => ({
		...day,
		events: busyEventsForRange(events, day.startsAt, day.endsAt),
	}));
}

function slotsStyle(): CSSProperties {
	return {
		'--hour-height': `${HOUR_HEIGHT_REM}rem`,
		'--minute-height': `${HOUR_HEIGHT_REM / 60}rem`,
	} as CSSProperties;
}

function eventMinuteOfDay(
	date: Date,
	day: Date,
	timeZone: string,
	boundary: 'start' | 'end'
) {
	const dayStart = day.getTime();
	const dayEnd = addZonedDays(day, 1, timeZone).getTime();
	if (date.getTime() <= dayStart) return 0;
	if (date.getTime() >= dayEnd) return MINUTES_PER_DAY;

	const parts = zonedParts(date, timeZone);
	const minute = parts.hour * 60 + parts.minute;
	return boundary === 'end' && minute === 0 ? MINUTES_PER_DAY : minute;
}

function eventStyle(event: CalendarEvent, day: Date, timeZone: string) {
	const startsAtMinute = eventMinuteOfDay(
		event.startsAt,
		day,
		timeZone,
		'start'
	);
	const endsAtMinute = eventMinuteOfDay(event.endsAt, day, timeZone, 'end');
	const startsAtLine = startsAtMinute + 1;

	return {
		gridRow: `${startsAtLine} / ${Math.max(
			startsAtLine + 1,
			endsAtMinute + 1
		)}`,
	};
}

function BusyEvent({
	day,
	event,
	formatTime,
	timeZone,
}: {
	readonly day: Date;
	readonly event: CalendarEvent;
	readonly formatTime: Intl.DateTimeFormat;
	readonly timeZone: string;
}) {
	return (
		<div
			className={style.busy}
			data-availability-busy
			style={eventStyle(event, day, timeZone)}
		>
			{formatTime.format(event.startsAt)} - {formatTime.format(event.endsAt)}
		</div>
	);
}

export function AvailabilityClient() {
	const [hydrated, setHydrated] = useState(false);
	const [locales, setLocales] = useState<LocaleList>(['en-US']);
	const [timeZone, setTimeZone] = useState('UTC');
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
		() => visibleDayRanges(start, locales, timeZone),
		[locales, start, timeZone]
	);
	const rangeEnd = useMemo(
		() => addZonedDays(start, 7, timeZone),
		[start, timeZone]
	);
	const events = calendarBatches(
		value => value.flat(),
		() => [],
		() => []
	);
	const loading = calendarBatches(
		() => false,
		() => true,
		() => false
	);
	const calendarLoadFailed = calendarBatches(
		() => false,
		() => false,
		() => true
	);
	const busyEvents = busyEventsForRange(events, start, rangeEnd);
	const dayBuckets = useMemo(
		() => bucketBusyEvents(busyEvents, days),
		[busyEvents, days]
	);
	const rulerLabels = useMemo(
		() =>
			days[0]
				? hourLabels(days[0].startsAt, formatTime, timeZone)
				: [],
		[days, formatTime, timeZone]
	);
	const gridStyle = useMemo(() => slotsStyle(), []);

	useEffect(() => {
		setLocales(resolvedLocales());
		setTimeZone(resolvedTimeZone());
		setHydrated(true);
	}, []);

	return (
		<div
			className={style.page}
			data-availability-state={
				!hydrated || loading
					? 'loading'
					: calendarLoadFailed
						? 'error'
						: 'ready'
			}
		>
			<header className={style.header}>
				<h1>Thomas' availability</h1>
				<p>
					Timed blocks below are times I am probably busy. All-day
					events are usually reminders, so they are left out.
				</p>
			</header>
			<section className={style.week} aria-label="Availability this week">
				{hydrated ? (
					<>
						<div className={style.ruler} aria-hidden="true">
							<div className={style.rulerHeader} />
							<div className={style.rulerSlots} style={gridStyle}>
								{rulerLabels.map(({ hour, label }) => (
									<div className={style.rulerLabel} key={hour}>
										{label}
									</div>
								))}
							</div>
						</div>
						{dayBuckets.map(day => (
							<article className={style.day} key={day.key}>
								<header
									className={style.dayHeader}
									data-availability-day-header
								>
									{day.label}
								</header>
								<div className={style.slots} style={gridStyle}>
									{day.events.length > 0
										? day.events.map((event, i) => (
												<BusyEvent
													day={day.startsAt}
													event={event}
													formatTime={formatTime}
													key={`${event.startsAt.toISOString()}-${i}`}
													timeZone={timeZone}
												/>
											))
										: null}
									{loading && day.events.length === 0 ? (
										<div className={style.empty}>Loading</div>
									) : null}
								</div>
							</article>
						))}
					</>
				) : (
					<div className={style.empty}>Loading</div>
				)}
			</section>
			{calendarLoadFailed ? (
				<p className={style.error}>
					One or more calendar feeds could not be loaded.
				</p>
			) : null}
		</div>
	);
}
