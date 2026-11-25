import { Temporal } from 'temporal-polyfill';

export type RulerUnit = 'year' | 'month' | 'day' | 'minute';
export const minuteMs = 60_000;
export const dayMs = 1440 * minuteMs;
export const firstInstant = Date.parse('0001-01-01T00:00:00Z');
const epochDate = Temporal.PlainDate.from('1970-01-01');

export function zonedTime(epoch: number, zone: string) {
	return Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO(
		zone
	);
}

// Year and month gears divide the local calendar. A day fills one division
// even when its clock skips or repeats an hour. The minute gear tracks elapsed time.
export function rulerPosition(unit: RulerUnit, epoch: number, zone = 'UTC') {
	if (unit === 'minute') return epoch / minuteMs;
	const local = zonedTime(epoch, zone);
	const fraction =
		(epoch - local.startOfDay().epochMilliseconds) /
		(local.hoursInDay * 3600000);
	if (unit === 'day')
		return epochDate.until(local.toPlainDate()).days + fraction;
	const month =
		local.year * 12 +
		local.month -
		1 +
		(local.day - 1 + fraction) / local.daysInMonth;
	return unit === 'year' ? month / 12 : month;
}

export function instantAtPosition(
	unit: RulerUnit,
	position: number,
	zone = 'UTC'
) {
	if (unit === 'minute') return Math.round(position * minuteMs);
	const divisions = unit === 'year' ? position * 12 : position;
	const whole = Math.floor(divisions);
	let fraction = divisions - whole;
	let date: Temporal.PlainDate;
	if (unit === 'day') date = epochDate.add({ days: whole });
	else {
		const month = Temporal.PlainDate.from({
			year: Math.floor(whole / 12),
			month: (((whole % 12) + 12) % 12) + 1,
			day: 1,
		});
		const days = fraction * month.daysInMonth;
		date = month.add({ days: Math.floor(days) });
		fraction = days - Math.floor(days);
	}
	const start = date.toZonedDateTime(zone);
	return (
		start.epochMilliseconds +
		Math.round(fraction * start.hoursInDay * 3600000)
	);
}
