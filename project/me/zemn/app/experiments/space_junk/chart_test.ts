import { describe, expect, it } from '@jest/globals';
import { Temporal } from 'temporal-polyfill';

import { readChart } from './chart.js';

describe('birthday launch anniversaries', () => {
	it('finds a December launch from the other side of New Year', () => {
		const [match] = readChart(Temporal.PlainDate.from('1950-01-01'));
		expect(match?.object.designator).toBe('1976-126V');
		expect(match?.days).toBe(-5);
	});

	it('counts forward from leap day', () => {
		const [match] = readChart(Temporal.PlainDate.from('2000-02-29'));
		expect(match?.object.designator).toBe('2009-011C');
		expect(match?.days).toBe(7);
	});

	it('keeps both readings for an equally close pair of anniversaries', () => {
		const matches = readChart(Temporal.PlainDate.from('2000-02-17'));
		expect(
			matches.map(({ object, days }) => [object.designator, days])
		).toEqual([
			['1984-008A', -19],
			['2009-011C', 19],
		]);
	});
});
