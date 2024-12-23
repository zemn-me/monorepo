

/**
 * Returns the number of days in the year
 * of the given {@link Date}.
 */
export function daysInYear(d: Date) {
	return (new Date(d.getFullYear(), 1, 29).getMonth() === 1)
		? 366
		: 365
}
