import { Temporal } from 'temporal-polyfill';

export type RulerUnit = 'year' | 'month' | 'day' | 'minute';
export const minuteMs = 60_000;
export const dayMs = 1440 * minuteMs;
export const firstInstant = Date.parse('0001-01-01T00:00:00Z');

// Calendar gears give each year twelve equal divisions. A month division
// spans its actual number of UTC days, including February 29 in leap years.
export function rulerPosition(unit: RulerUnit, epoch: number) {
	if (unit === 'minute') return epoch / minuteMs;
	if (unit === 'day') return epoch / dayMs;
	const utc =
		Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO('UTC');
	const dayFraction = (epoch - utc.startOfDay().epochMilliseconds) / dayMs;
	const fraction = (utc.day - 1 + dayFraction) / utc.daysInMonth;
	const months = utc.year * 12 + utc.month - 1 + fraction;
	return unit === 'year' ? months / 12 : months;
}

export function instantAtPosition(unit: RulerUnit, position: number) {
	if (unit === 'minute') return Math.round(position * minuteMs);
	if (unit === 'day') return Math.round(position * dayMs);
	const months = unit === 'year' ? position * 12 : position;
	const whole = Math.floor(months);
	const start = Temporal.PlainDate.from({
		year: Math.floor(whole / 12),
		month: (whole % 12) + 1,
		day: 1,
	});
	const elapsed = Math.round((months - whole) * start.daysInMonth * dayMs);
	return start.toZonedDateTime('UTC').epochMilliseconds + elapsed;
}
