import { describe, expect, test } from '@jest/globals';

import { childPeriodsFor } from '#root/project/me/zemn/app/journal/periods.js';

const september = {
	start: '2026-09-01T00:00:00-07:00',
	end: '2026-10-01T00:00:00-07:00',
};

const firstWeek = {
	id: 'first week',
	start: '2026-08-31T00:00:00-07:00',
	end: '2026-09-07T00:00:00-07:00',
};

describe('journal child periods', () => {
	test('includes the first week when it starts in the previous month', () => {
		expect(childPeriodsFor([firstWeek], september)).toEqual([firstWeek]);
	});

	test('includes a week in both months it overlaps', () => {
		const august = {
			start: '2026-08-01T00:00:00-07:00',
			end: september.start,
		};
		expect(childPeriodsFor([firstWeek], august)).toEqual([firstWeek]);
		expect(childPeriodsFor([firstWeek], september)).toEqual([firstWeek]);
	});

	test('includes the first week of January across a year boundary', () => {
		const january = {
			start: '2027-01-01T00:00:00-08:00',
			end: '2027-02-01T00:00:00-08:00',
		};
		const week = {
			start: '2026-12-28T00:00:00-08:00',
			end: '2027-01-04T00:00:00-08:00',
		};
		expect(childPeriodsFor([week], january)).toEqual([week]);
	});

	test('excludes disjoint periods and periods that only touch a boundary', () => {
		const outside = [
			{ start: '2026-08-01T07:00:00Z', end: '2026-08-08T07:00:00Z' },
			{ start: '2026-08-31T07:00:00Z', end: '2026-09-01T07:00:00Z' },
			{ start: '2026-10-01T07:00:00Z', end: '2026-10-02T07:00:00Z' },
			{ start: '2026-10-05T07:00:00Z', end: '2026-10-12T07:00:00Z' },
		];
		expect(childPeriodsFor(outside, september)).toEqual([]);
	});

	test('preserves the order and identity of matching periods', () => {
		const lastWeek = {
			id: 'last week',
			start: '2026-09-28T00:00:00-07:00',
			end: '2026-10-05T00:00:00-07:00',
		};
		const middleWeek = {
			id: 'middle week',
			start: '2026-09-14T00:00:00-07:00',
			end: '2026-09-21T00:00:00-07:00',
		};
		const result = childPeriodsFor([lastWeek, middleWeek, firstWeek], september);
		expect(result).toEqual([lastWeek, middleWeek, firstWeek]);
		expect(result[0]).toBe(lastWeek);
	});
});
