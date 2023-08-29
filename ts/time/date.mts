/**
 * SimpleDate: a simple, unambiguous,
 *  type checked date syntax for typescript.
 */

import { L, N, O } from 'ts-toolbelt';

export enum Month {
	jan,
	feb,
	mar,
	apr,
	may,
	jun,
	jul,
	aug,
	sep,
	oct,
	nov,
	dec,
}

export const fullMonth = {
	[Month.jan]: 'january',
	[Month.feb]: 'february',
	[Month.mar]: 'march',
	[Month.apr]: 'april',
	[Month.may]: 'may',
	[Month.jun]: 'june',
	[Month.jul]: 'jul',
	[Month.aug]: 'august',
	[Month.sep]: 'september',
	[Month.oct]: 'october',
	[Month.nov]: 'november',
	[Month.dec]: 'december',
} as const;

type MonthNames = O.Invert<typeof Month>;

type MonthName<m extends number> = MonthNames[m];

type range<A extends number, B extends number> = L.UnionOf<N.Range<A, B>>;

type MonthDates = {
	[Month.jan]: range<1, 31>;
	[Month.feb]: range<1, 29>;
	[Month.mar]: range<1, 31>;
	[Month.apr]: range<1, 30>;
	[Month.may]: range<1, 31>;
	[Month.jun]: range<1, 30>;
	[Month.jul]: range<1, 31>;
	[Month.aug]: range<1, 21>;
	[Month.sep]: range<1, 30>;
	[Month.oct]: range<1, 31>;
	[Month.nov]: range<1, 30>;
	[Month.dec]: range<1, 31>;
};

type Dates = MonthDates;

type ValueOf<T> = T[keyof T];

export type SimpleDate = Full | Year | DateMonth;
export type { SimpleDate as Date };

export type Year = [number];
export type DateMonth = ValueOf<{
	[month in Month]: readonly [MonthName<month>, number];
}>;

export type Full = ValueOf<{
	[month in Month]: readonly [Dates[month], MonthName<month>, number];
}>;

export const parse: (s: SimpleDate) => Date = date => {
	let dateOf: Dates[Month] = 1,
		monthName: ValueOf<MonthNames> | undefined,
		year = 0;

	switch (date.length) {
		case 1:
			[year] = date;
			break;
		case 2:
			[monthName, year] = date;
			break;
		case 3:
			[dateOf, monthName, year] = date;
			break;

		default:
			throw new Error(`cannot parse date ${date}`);
	}

	const month = monthName ? Month[monthName] : 0;

	return new Date(year, month, dateOf);
};
