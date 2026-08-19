import { describe, expect, it } from '@jest/globals';
import { renderToStaticMarkup } from 'react-dom/server';
import { Temporal } from 'temporal-polyfill';

import { DateRange } from './date.js';

function date(value: string): Temporal.ZonedDateTime {
	return Temporal.ZonedDateTime.from(`${value}T00:00[Europe/London]`);
}

function renderRange(start: string, end: string): string {
	return renderToStaticMarkup(
		<DateRange end={date(end)} start={date(start)} />
	);
}

describe('DateRange', () => {
	it('compacts a range within one month', () => {
		expect(renderRange('2026-08-10', '2026-08-17')).toContain(
			'Monday, the 10<sup>th</sup>–17<sup>th</sup> of August 2026'
		);
	});

	it('retains both month names when a range crosses a month', () => {
		expect(renderRange('2026-08-31', '2026-09-07')).toContain(
			'Monday, the 31<sup>st</sup> of August–7<sup>th</sup> of September 2026'
		);
	});

	it('retains both years when a range crosses a year', () => {
		expect(renderRange('2026-12-28', '2027-01-04')).toContain(
			'Monday, the 28<sup>th</sup> of December 2026–4<sup>th</sup> of January 2027'
		);
	});
});
