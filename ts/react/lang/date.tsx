'use client';

import { Fragment, memo, ReactElement } from 'react';
import { Temporal } from 'temporal-polyfill';

import { isDefined } from '#root/ts/guard.js';
import { formatTimeZone } from '#root/ts/react/lang/format_time_zone.js';
import { useLocale } from '#root/ts/react/lang/useLocale.js';

const DEFAULT_TIME_ZONE = 'UTC';

export type SupportedDateInput = Temporal.ZonedDateTime | globalThis.Date;

export interface DateProps {
	readonly date: SupportedDateInput;
	readonly className?: string;
	readonly time?: boolean;
}

export interface DateRangeProps {
	readonly start: SupportedDateInput;
	readonly end: SupportedDateInput;
	readonly className?: string;
}

function isTemporalZonedDateTime(
	value: SupportedDateInput
): value is Temporal.ZonedDateTime {
	return value instanceof Temporal.ZonedDateTime;
}

function normalizeToZonedDateTime(
	date: SupportedDateInput
): Temporal.ZonedDateTime {
	if (isTemporalZonedDateTime(date)) {
		return date;
	}
	if (Number.isNaN(date.valueOf())) {
		throw new RangeError('Invalid time value');
	}
	const instant = Temporal.Instant.from(date.toISOString());
	return instant.toZonedDateTimeISO(DEFAULT_TIME_ZONE);
}

/**
 * Choose a concrete locale from a raw language tag. We default plain
 * English (`en`) to British English (`en-GB`).
 */
function selectLocale(language: string): Intl.Locale {
	const base = new Intl.Locale(language);
	return base.language === 'en' ? new Intl.Locale('en-GB') : base;
}

/**
 * Return the Intl‑generated parts needed to assemble a full date.
 */
function getDateParts(
	date: Temporal.ZonedDateTime,
	locale: Intl.Locale,
	time: boolean
): Intl.DateTimeFormatPart[] {
	// biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any
	return new Intl.DateTimeFormat(locale as any, {
		dateStyle: 'full',
		timeStyle: time ? 'short' : undefined,
		timeZone: date.timeZoneId,
	}).formatToParts(zonedDateToDate(date));
}

function getTimeText(
	date: Temporal.ZonedDateTime,
	locale: Intl.Locale
): string {
	// biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any
	return new Intl.DateTimeFormat(locale as any, {
		timeStyle: 'short',
		timeZone: date.timeZoneId,
	}).format(zonedDateToDate(date));
}

type FullDateField = 'weekday' | 'day' | 'month' | 'year';

function getFullDateFields(
	parts: readonly Intl.DateTimeFormatPart[]
): ReadonlyMap<FullDateField, string> | undefined {
	const wanted = new Set<FullDateField>(['weekday', 'day', 'month', 'year']);
	const fields = new Map(
		parts
			.map(part =>
				wanted.has(part.type as FullDateField)
					? ([part.type as FullDateField, part.value] as const)
					: undefined
			)
			.filter(isDefined)
	);

	return fields.size === wanted.size ? fields : undefined;
}

function englishOrdinalSuffix(day: number, language: string): string {
	const rule = new Intl.PluralRules(language, { type: 'ordinal' }).select(
		day
	);
	return {
		one: 'st',
		two: 'nd',
		few: 'rd',
		other: 'th',
		zero: '',
		many: '',
	}[rule];
}

function OrdinalDay({
	day,
	language,
}: {
	readonly day: string;
	readonly language: string;
}) {
	return (
		<>
			{day}
			<sup>{englishOrdinalSuffix(+day, language)}</sup>
		</>
	);
}

/**
 * Build an English date in the form:
 *   Friday, the 3rd of January 2024
 * (Chrome and Firefox disagree on the default en‑GB format, so we roll our own.)
 */
function formatEnglish(
	parts: readonly Intl.DateTimeFormatPart[],
	language: string,
	time: string | undefined
): ReactElement | undefined {
	const fields = getFullDateFields(parts);
	if (!fields) return undefined;

	return (
		<>
			{fields.get('weekday')}, the{' '}
			<OrdinalDay day={fields.get('day')!} language={language} /> of{' '}
			{fields.get('month')} {fields.get('year')}
			{time ? <> at {time}</> : null}
		</>
	);
}

/**
 * Build a compact English date range without repeating shared month/year
 * context, for example «Monday, the 10th–17th of August 2026».
 */
function formatEnglishDateRange(
	startParts: readonly Intl.DateTimeFormatPart[],
	endParts: readonly Intl.DateTimeFormatPart[],
	language: string
): ReactElement | undefined {
	const start = getFullDateFields(startParts);
	const end = getFullDateFields(endParts);
	if (!start || !end) return undefined;

	if (
		start.get('day') === end.get('day') &&
		start.get('month') === end.get('month') &&
		start.get('year') === end.get('year')
	) {
		return formatEnglish(startParts, language, undefined);
	}

	const startDay = <OrdinalDay day={start.get('day')!} language={language} />;
	const endDay = <OrdinalDay day={end.get('day')!} language={language} />;
	const prefix = (
		<>
			{start.get('weekday')}, the {startDay}
		</>
	);

	if (
		start.get('month') === end.get('month') &&
		start.get('year') === end.get('year')
	) {
		return (
			<>
				{prefix}–{endDay} of {end.get('month')} {end.get('year')}
			</>
		);
	}

	if (start.get('year') === end.get('year')) {
		return (
			<>
				{prefix} of {start.get('month')}–{endDay} of {end.get('month')}{' '}
				{end.get('year')}
			</>
		);
	}

	return (
		<>
			{prefix} of {start.get('month')} {start.get('year')}–{endDay} of{' '}
			{end.get('month')} {end.get('year')}
		</>
	);
}

export function formatDatePartsWithOrdinalDay(
	parts: readonly Intl.DateTimeFormatPart[],
	locale: Intl.Locale,
	language: string = locale.toString()
): ReactElement {
	if (locale.language === 'en') {
		// English is the only locale where this project rewrites month/day
		// prose. Other locales keep the order and connectors generated by Intl.
		const fields = new Map(
			parts
				.map(part =>
					part.type === 'day' || part.type === 'month'
						? ([part.type, part.value] as const)
						: undefined
				)
				.filter(isDefined)
		);

		if (fields.has('day') && fields.has('month')) {
			return (
				<>
					<OrdinalDay day={fields.get('day')!} language={language} />{' '}
					of {fields.get('month')}
				</>
			);
		}

		return (
			<>
				{parts.map((part, index) =>
					part.type === 'day' ? (
						<Fragment key={index}>
							<OrdinalDay day={part.value} language={language} />
						</Fragment>
					) : (
						<Fragment key={index}>{part.value}</Fragment>
					)
				)}
			</>
		);
	}

	const partsWithOrdinal = [...parts];
	if (locale.language === 'it') {
		appendItalianOrdinalMarker(partsWithOrdinal);
	}

	return <>{partsWithOrdinal.map(part => part.value).join('')}</>;
}

/**
 * Append the correct ordinal marker (º or ª) to the day for Italian dates.
 */
function appendItalianOrdinalMarker(parts: Intl.DateTimeFormatPart[]): void {
	const dayIndex = parts.findIndex(p => p.type === 'day');
	if (dayIndex === -1) return;

	const month = parts.find(p => p.type === 'month');
	if (!month) return;

	const marker = month.value.endsWith('a')
		? 'ª'
		: month.value.endsWith('o')
			? 'º'
			: '';
	if (marker) {
		parts[dayIndex] = {
			...parts[dayIndex]!,
			value: parts[dayIndex]!.value + marker,
		};
	}
}

function zonedDateToDate(date: Temporal.ZonedDateTime): Date {
	return new globalThis.Date(date.epochMilliseconds);
}

/**
 * Month–year formatter (e.g. «June 2011»).
 * Uses the current locale’s long month name followed by the numeric year.
 */
function formatMonthYear(
	date: Temporal.ZonedDateTime,
	locale: Intl.Locale
): string {
	// biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any
	return new Intl.DateTimeFormat(locale as any, {
		month: 'long',
		year: 'numeric',
		timeZone: date.timeZoneId,
	}).format(zonedDateToDate(date));
}

function formatNativeDateRange(
	start: Temporal.ZonedDateTime,
	end: Temporal.ZonedDateTime,
	locale: Intl.Locale
): string {
	// biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any
	return new Intl.DateTimeFormat(locale as any, {
		dateStyle: 'full',
		timeZone: start.timeZoneId,
	}).formatRange(zonedDateToDate(start), zonedDateToDate(end));
}

/**
 * Full date component (e.g. «Friday, the 3rd of January 2024»).
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: this component's public API is named Date.
export const Date = memo(function DateComponent(props: DateProps) {
	const [language] = useLocale();
	const locale = selectLocale(language);
	const zonedDate = normalizeToZonedDateTime(props.date);
	const parts = getDateParts(zonedDate, locale, props.time ?? false);

	let content: ReactElement | undefined;

	switch (locale.language) {
		case 'en':
			content = formatEnglish(
				parts,
				language,
				props.time ? getTimeText(zonedDate, locale) : undefined
			);
			break;
	}

	if (content === undefined) {
		content = formatDatePartsWithOrdinalDay(parts, locale, language);
	}

	return (
		<time
			className={props.className}
			dateTime={zonedDate.toString()}
			lang={locale.toString()}
		>
			{content}
		</time>
	);
});

/**
 * Localized date range. English ranges retain this project's prose and
 * ordinal-day style; other locales use Intl's native range compaction.
 */
export const DateRange = memo(function DateRangeComponent(
	props: DateRangeProps
) {
	const [language] = useLocale();
	const locale = selectLocale(language);
	const start = normalizeToZonedDateTime(props.start);
	const end = normalizeToZonedDateTime(props.end).withTimeZone(
		start.timeZoneId
	);
	if (Temporal.ZonedDateTime.compare(start, end) > 0) {
		throw new RangeError('Date range ends before it starts');
	}

	const nativeText = formatNativeDateRange(start, end, locale);
	const content =
		locale.language === 'en'
			? (formatEnglishDateRange(
					getDateParts(start, locale, false),
					getDateParts(end, locale, false),
					language
				) ?? nativeText)
			: nativeText;

	return (
		<span
			aria-label={nativeText}
			className={props.className}
			lang={locale.toString()}
		>
			{content}
		</span>
	);
});

/**
 * Month–Year component (e.g. «June 2011»).
 */
export const MonthYear = memo(function MonthYearComponent(props: DateProps) {
	const [language] = useLocale();
	const locale = selectLocale(language);
	const zonedDate = normalizeToZonedDateTime(props.date);
	const text = formatMonthYear(zonedDate, locale);

	return (
		<time
			className={props.className}
			dateTime={zonedDate.toString()}
			lang={locale.toString()}
		>
			{text}
		</time>
	);
});

/**
 * Localized time without a date (e.g. «19:16»).
 */
export const Time = memo(function TimeComponent(
	props: Omit<DateProps, 'time'>
) {
	const [language] = useLocale();
	const locale = selectLocale(language);
	const zonedDate = normalizeToZonedDateTime(props.date);

	return (
		<time
			className={props.className}
			dateTime={zonedDate.toString()}
			lang={locale.toString()}
		>
			{getTimeText(zonedDate, locale)}
		</time>
	);
});

export interface PrettyDateTimeProps {
	readonly date: Temporal.ZonedDateTime;
	readonly className?: string;
}

/**
 *
 */
export const PrettyDateTime = memo(function PrettyDateTime(
	props: PrettyDateTimeProps
) {
	const [language] = useLocale();
	const locale = selectLocale(language);
	const localTz = Temporal.Now.zonedDateTimeISO().timeZoneId;

	const follower = props.date.timeZoneId ? (
		<>
			(<Date date={props.date} /> in{' '}
			{formatTimeZone(props.date.timeZoneId)})
		</>
	) : null;

	return (
		<time
			className={props.className}
			dateTime={props.date.toString()}
			lang={locale.toString()}
		>
			<Date date={props.date.withTimeZone(localTz)} />{' '}
			{/* local time zone */}
			{follower} {/* poster time zone */}
		</time>
	);
});
