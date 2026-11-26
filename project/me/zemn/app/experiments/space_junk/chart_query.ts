import { createParser } from 'nuqs';
import { Temporal } from 'temporal-polyfill';
import { catalogueDate } from './catalogue_date.js';
import { firstInstant } from './ruler_time.js';

const lastInstant = Date.parse(catalogueDate + 'T23:59:59.999Z');
export const birthInstant = createParser<number>({
	parse(value) {
		try {
			const instant = Temporal.Instant.from(value).epochMilliseconds;
			return instant >= firstInstant && instant <= lastInstant
				? instant
				: null;
		} catch {
			return null;
		}
	},
	serialize: (value: number) => new Date(value).toISOString(),
}).withDefault(Date.UTC(2006, 7, 1, 12));

export function boundedNumber(min: number, max: number) {
	return createParser<number>({
		parse(value) {
			const n = Number(value);
			return value.trim() && Number.isFinite(n) && n >= min && n <= max
				? n
				: null;
		},
		serialize: String,
	});
}
export const catalogueId = createParser<number>({
	parse: value =>
		/^\d+$/.test(value) &&
		Number.isSafeInteger(Number(value)) &&
		Number(value) > 0
			? Number(value)
			: null,
	serialize: String,
});
