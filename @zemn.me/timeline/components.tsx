import { Bio, Event as BioEvent } from '@zemn.me/bio';
import { Span, Div, A, Time, classes } from '@zemn.me/linear';
import { Text } from '@zemn.me/lang/component';
import * as lang from '@zemn.me/lang';
import * as simpletime from '@zemn.me/simpletime';
import React from 'react';
import style from './style.module.css';


const setFallback:
    <T1, T2>(k: T1, v: () => T2, m: Map<T1, T2>) => T2
    =
    (k, v, m) => {
        const val = m.get(k) ?? v();
        m.set(k, val);
        return val;
    }
    ;


export interface Year {
    readonly year: number,
    readonly months: readonly Month[]
}

export const makeYears:
    (b: Bio["timeline"]) => Year[]
    =
    (timeline) => {
        const yearMappings: Map<number, BioEvent[]> = new Map();

        for (const event of timeline)
            setFallback(
                event.date.getFullYear(),
                () => [],
                yearMappings
            ).push(event);

        const yearsToMonths: Map<number,
            Map<simpletime.Month, BioEvent[]>> = new Map();

        // i made this operation higher level and it made even
        // less sense, for which i am sorry
        for (const [year, events] of yearMappings)
            for (const event of events)
                setFallback(
                    event.date.getMonth(),
                    () => [],
                    setFallback<number, Map<simpletime.Month, BioEvent[]>>(
                        year,
                        () => new Map(),
                        yearsToMonths
                    )
                ).push(event);


        const years: Year[] =
            [...yearsToMonths].map(([year, months]) => ({
                year,
                months: [...months].map(([month, events]) => ({
                    month,
                    events: events.sort(({ date: a }, { date: b }) => +b - +a)
                })).sort(({ month: a }, { month: b }) => a - b)
            })).sort(({ year: a }, { year: b }) => b - a);


        return years;
    }
    ;

export interface TimelineProps {
    readonly years: readonly Year[]
    readonly lang: lang.Lang,
    className?: string
}

export const Timeline:
    (props: TimelineProps) => React.ReactElement
    =
    ({ years, lang, className }) => <Div {...{
        ...classes(className, style.Timeline)
    }}> {years.map(year =>
        <Year key={year.year} {...year} lang={lang} />
    )} </Div>
    ;

export interface YearProps extends Year {
    readonly lang: lang.Lang
}

export const Year:
    (props: YearProps) => React.ReactElement
    =
    ({ year, months, lang }) =>
        <Div {...{
            className: style.Year,
            "data-year": year
        }} >
            <StretchIndicatorArea>
                <article>
                    <YearDisplay
                        year={new Date(new Date(0).setFullYear(year))}/>

                    {months.map((month) =>
                        <Month lang={lang} key={month.month} {...month} />
                    )}
                </article>
            </StretchIndicatorArea>

        </Div>
    ;

const numerals = [
    [3000, "MMM"],
    [2000, "MM"],
    [1000, "M"],
    [900, "CM"],
    [800, "DCCC"],
    [700, "DCC"],
    [600, "DC"],
    [500, "D"],
    [400, "CD"],
    [300, "CCC"],
    [200, "CC"],
    [100, "C"],
    [90, "XC"],
    [80, "LXXX"],
    [70, "LXX"],
    [60, "LX"],
    [50, "L"],
    [40, "XL"],
    [30, "XXX"],
    [20, "XX"],
    [10, "X"],
    [9, "IX"],
    [8, "VIII"],
    [7, "VII"],
    [6, "VI"],
    [5, "V"],
    [3, "III"],
    [4, "IV"],
    [2, "II"],
    [1, "I"],
] as const;

const romanize:
    (n: number) => string
    =
    n => {
        if (n == 0) return "";
        for (const [val, str] of numerals)
            if (n >= val) return str + romanize(n - val);

        throw new Error("this should never happen");
    }
    ;


const YearDisplay: React.FC<{ year: Date }> = ({ year: date }) => {
    const year = date.getFullYear();
    const age = year - 1994;

    return <Time className={style.yearDisplay}
            dateTime={new Date(new Date(0).setFullYear(year))}>
            <Div className={style.yearDisplayRoman}>
                {romanize(year)}
            </Div>
            <Div className={style.yearDisplayYear}>{year}</Div>
            <Div className={style.yearDisplayAge}>{romanize(age)}</Div>
        </Time>

}

export interface Month {
    readonly month: simpletime.Month
    readonly events: readonly BioEvent[]
}

export interface MonthProps extends Month {
    readonly lang: lang.Lang
}

export const Month:
    (props: MonthProps) => React.ReactElement
    =
    ({ month, events, lang }) => <Div {...{
        className: style.Month }}>

        <MonthIndicator month={month}/>
        {events.map((event, i) =>
            <Event lang={lang} key={i} {...event} />
        )}
    </Div>
    ;

export const MonthIndicator: React.FC<{ month: simpletime.Month }> =
    ({ month }) => <Div className={style.monthIndicator}
        aria-label={simpletime.fullMonth[month]}>
        <span aria-hidden>{simpletime.Month[month]}</span>
    </Div>

;

export interface EventProps extends BioEvent {
    lang: lang.Lang
}

export const Event:
    (props: EventProps) => React.ReactElement
    =
    ({ description, title, url, lang }) => <Div {...{
        className: style.Event
    }}>
        <Text {...{
            lang,
            into: <A {...{
                className: style.title,
                ...url ? { href: url.toString() } : {}
            }} />
        }}>
            {title}
        </Text>

        {" "}

        {description ?
            <Text into={<Span className={style.description} />} lang={lang}>
                {description}
            </Text> : null}
    </Div>
    ;

interface VerticalStretchIndicatorProps {
    className?: string
}

const VerticalStretchIndicator:
    (props?: VerticalStretchIndicatorProps) => React.ReactElement
    =
    ({ className } = {}) => <Div {...{
        ...classes(className, style.VerticalStretchIndicator),
    }} />
    ;

interface StretchIndicatorAreaProps {
    className?: string
    children: React.ReactElement<{ className?: any }>
}

const StretchIndicatorArea:
    (props: StretchIndicatorAreaProps) => React.ReactElement
    =
    ({ className, children }) => <Div {...{
        ...classes(className, style.StretchArea)
    }}>

        {children}

        <VerticalStretchIndicator />
    </Div>
    ;