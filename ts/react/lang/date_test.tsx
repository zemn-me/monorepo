import { describe, expect, it } from '@jest/globals';
import { renderToStaticMarkup } from 'react-dom/server';
import { Temporal } from 'temporal-polyfill';

import { DateRange } from './date.js';

function date(value: string): Temporal.ZonedDateTime {
	return Temporal.ZonedDateTime.from(`${value}T00:00[Europe/London]`);
}

function renderRange(start: string, end: string): string | null {
	return renderToStaticMarkup(
		<DateRange end={date(end)} start={date(start)} />
	).replace(/<[^>]+>/g, '');
}

describe('DateRange', () => {
	it('compacts a range within one month', () => {
		expect(renderRange('2026-08-10', '2026-08-17')).toBe(
			'Monday, the 10th–17th of August 2026'
		);
	});

	it('retains both month names when a range crosses a month', () => {
		expect(renderRange('2026-08-31', '2026-09-07')).toBe(
			'Monday, the 31st of August–7th of September 2026'
		);
	});

	it('retains both years when a range crosses a year', () => {
		expect(renderRange('2026-12-28', '2027-01-04')).toBe(
			'Monday, the 28th of December 2026–4th of January 2027'
		);
	});
});
