import { Bio, Event as BioEvent } from '@zemn.me/bio';
import * as e from 'linear2/features/elements';
import * as model from 'linear2/model';
import React from 'react';
import style from './style.module.css';
import classes from 'classnames';

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
            Map<model.time.date.Month, BioEvent[]>> = new Map();

        // i made this operation higher level and it made even
        // less sense, for which i am sorry
        for (const [year, events] of yearMappings)
            for (const event of events)
                setFallback(
                    event.date.getMonth(),
                    () => [],
                    setFallback<number, Map<model.time.date.Month, BioEvent[]>>(
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
                    year,
                    events: events.sort(({ date: a }, { date: b }) => +b - +a)
                })).sort(({ month: a }, { month: b }) => a - b)
            })).sort(({ year: a }, { year: b }) => b - a);


        return years;
    }
    ;

export interface TimelineProps {
    readonly years: readonly Year[]
    readonly lang: model.lang.Lang,
    className?: string
}

export const Timeline:
    (props: TimelineProps) => React.ReactElement
    =
    ({ years, lang, className }) => <e.div
        className={classes(className, style.Timeline)}
    > {years.map(year =>
        <Year key={year.year} {...year} lang={lang} />
    )} </e.div>
    ;

export interface YearProps extends Year {
    readonly lang: model.lang.Lang
}

export const Year:
    (props: YearProps) => React.ReactElement
    =
    ({ year, months, lang }) =>
        <e.div {...{
            className: style.Year,
            "data-year": year
        }} >
            <StretchIndicatorArea>
                <article>
                    <YearDisplay
                        year={new Date(new Date(0).setFullYear(year))}
                        n={months.length}/>

                    {months.map((month) =>
                        <Month lang={lang} key={month.month} {...month} />
                    )}
                </article>
            </StretchIndicatorArea>

        </e.div>
    ;





const s = (n: number) => {
    if (n > 7) return "✵";
    if (n > 5) return "✴";
    if (n > 3) return "✳";
    if (n > 2) return "✲";
}

const YearDisplay:
    React.FC<{ year: Date, n: number }>
=
    ({ year: date, n }) => {
        const year = date.getFullYear();
        const age = year - 1994;

        return <e.date className={style.yearDisplay}
            date={new Date(new Date(0).setFullYear(year))}>
            <e.div className={style.yearDisplayRoman}>
                {
                    s(n)
                }
            </e.div>
            <e.date {...{
                date: date,
                into: <e.div className={style.yearDisplayYear}/>,
                year: "numeric"
            }}/>
            <e.div className={style.yearDisplayAge}>{romanize(age)}</e.div>
        </e.date>

    }
;

export interface Month {
    readonly month: model.time.date.Month
    readonly year: number
    readonly events: readonly BioEvent[]
}

export interface MonthProps extends Month {
    readonly lang: i8n.Lang
}

export const Month:
    (props: MonthProps) => React.ReactElement
    =
    ({ month, events, lang, year }) => <e.div {...{
        className: style.Month }}>

        <MonthIndicator month={month} year={year}/>
        {events.map((event, i) =>
            <Event lang={lang} key={i} {...event} />
        )}
    </e.div>
    ;

export const MonthIndicator:
    React.FC<{ year: number, month: model.time.date.Month }>
=
    ({ month, year }) => {
        const [l] = React.useContext(i8n.locale);
        const d = new Date(0);
        d.setFullYear(year);
        d.setMonth(month);
        const longMonth = d.toLocaleDateString(l, {
            month: "long"
        });

        return <i8n.Date {...{
            date: d,
            into: <e.date
                className={style.MonthIndicator}
                aria-label={longMonth} dateTime={d}/>,
            month: "short"
        }}/>
    }
;

export interface EventProps extends BioEvent {
    lang: i8n.Lang
}

export const Event:
    (props: EventProps) => React.ReactElement
    =
    ({ description, title, url, lang }) => <e.div {...{
        className: style.Event
    }}>
        <Text {...{
            lang,
            into: <e.a {...{
                className: style.title,
                ...url ? { href: url.toString() } : {}
            }} />
        }}>
            {title}
        </Text>

        {" "}

        {description ?
            <Text into={<e.span className={style.description} />} lang={lang}>
                {description}
            </Text> : null}
    </e.div>
    ;

interface VerticalStretchIndicatorProps {
    className?: string
}

const VerticalStretchIndicator:
    (props?: VerticalStretchIndicatorProps) => React.ReactElement
    =
    ({ className } = {}) => <e.div {...{
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
    ({ className, children }) => <e.div {...{
        ...classes(className, style.StretchArea)
    }}>

        {children}

        <VerticalStretchIndicator />
    </e.div>
    ;