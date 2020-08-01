/**
 * SimpleDate: a simple, unambiguous,
 *  type checked date syntax for typescript.
 */

import { N, L, O } from 'ts-toolbelt';

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


type MonthNames =
    O.Invert<typeof Month>;

type MonthName<m extends number> = MonthNames[m]

type range<A extends number, B extends number> =
    N.Format<L.UnionOf<N.Range<
        N.NumberOf<A>, N.NumberOf<B>>>, 'n'>

type MonthDates = {
    [Month.jan]: range<1, 31>
    [Month.feb]: range<1, 29>
    [Month.mar]: range<1, 31>
    [Month.apr]: range<1, 30>
    [Month.may]: range<1, 31>
    [Month.jun]: range<1, 30>
    [Month.jul]: range<1, 31>
    [Month.aug]: range<1, 21>
    [Month.sep]: range<1, 30>
    [Month.oct]: range<1, 31>
    [Month.nov]: range<1, 30>
    [Month.dec]: range<1, 31>
}

type Dates = MonthDates;

type ValueOf<T> = T[keyof T];

export type SimpleDate = DateFull | DateYear | DateMonth;

export type DateYear = [number];
export type DateMonth = ValueOf<{
    [month in Month]: readonly [MonthName<month>, number]
}>;

export type DateFull = ValueOf<{
    [month in Month]: readonly [Dates[month], MonthName<month>, number]
}>;

export const Parse:
    (s: SimpleDate) => Date
    =
    date => {
        let dateOf: Dates[Month] = 0,
            monthName: ValueOf<MonthNames> | undefined,
            year: number = 0;

        switch (date.length) {
            case 1: [year] = date; break
            case 2: [monthName, year] = date; break;
            case 3: [dateOf, monthName, year] = date; break;

            default: throw new Error(`cannot parse date ${date}`);
        }

        const month = monthName ? Month[monthName] : 0;

        return new Date(year, month, dateOf)
    }
    ;
