import Immutable from 'immutable';
import * as Bio from 'project/zemn.me/bio';
import style from 'project/zemn.me/next/components/timeline/timeline.module.css';
import React from 'react';
import * as lang from 'ts/react/lang';

const numerals = [
	[3000, 'MMM'],
	[2000, 'MM'],
	[1000, 'M'],
	[900, 'CM'],
	[800, 'DCCC'],
	[700, 'DCC'],
	[600, 'DC'],
	[500, 'D'],
	[400, 'CD'],
	[300, 'CCC'],
	[200, 'CC'],
	[100, 'C'],
	[90, 'XC'],
	[80, 'LXXX'],
	[70, 'LXX'],
	[60, 'LX'],
	[50, 'L'],
	[40, 'XL'],
	[30, 'XXX'],
	[20, 'XX'],
	[10, 'X'],
	[9, 'IX'],
	[8, 'VIII'],
	[7, 'VII'],
	[6, 'VI'],
	[5, 'V'],
	[4, 'IV'],
	[3, 'III'],
	[2, 'II'],
	[1, 'I'],
] as const;

const romanize = (n: number): lang.TaggedText<string> => {
	const parts: string[] = [];
	while (n > 0) {
		for (const [value, sym] of numerals) {
			if (n < value) continue;
			parts.push(sym);
			n -= value;
			break;
		}
	}

	//      ↓ unicode for 'no specified language, roman numerals used for numbering'
	return ['zxx-u-nu-romanlow', parts.join('')];
};

/**
 * Given a map that contains a set, set a single item, expanding or creating
 * the set if needed.
 * @param v the map
 * @param key the key in the map
 * @param value the item to set
 * @returns the same map that was put in
 */
function setManyMap<K, V>(
	v: Immutable.OrderedMap<K, Immutable.List<V>>,
	key: K,
	value: V
): Immutable.OrderedMap<K, Immutable.List<V>> {
	return v.set(key, v.get(key, Immutable.List<V>()).concat(value));
}

function groupBy<T, Q>(
	i: Iterable<T>,
	select: (v: T) => Q
): Immutable.Map<Q, Immutable.List<T>> {
	let m = Immutable.OrderedMap<Q, Immutable.List<T>>();
	for (const v of i) m = setManyMap(m, select(v), v);

	return m;
}

function Event({ event: e }: { event: Bio.Event }) {
	return (
		<div className={style.event}>
			<a href={e.url?.toString()} lang={lang.get(e.title)}>
				{lang.text(e.title)}
			</a>{' '}
			{e.description ? (
				<span lang={lang.get(e.description)}>
					{lang.text(e.description)}
				</span>
			) : null}
		</div>
	);
}

export interface MonthProps {
	month: Immutable.FromJS<lang.Text<string>>;
	events: Iterable<Bio.Event>;
}

function Month({ month, events }: MonthProps) {
	return (
		<div className={style.month}>
			<header className={style.monthName} lang="en-GB">
				{' '}
				{/* <- this needs to be set to the correct language */}
				{month}
			</header>
			<div className={style.content}>
				{[...events].map((e, i) => (
					<Event event={e} key={i} />
				))}
			</div>
		</div>
	);
}

export interface YearProps {
	year: Immutable.FromJS<lang.Text<string>>;
	months: Immutable.OrderedMap<
		Immutable.FromJS<lang.Text<string>>,
		MonthProps['events']
	>;
}

function Year({ year, months }: YearProps) {
	const romanizedAge = romanize(
		(months.first(undefined)?.first()?.date.getFullYear() ?? 0) - 1994
	);
	return (
		<div className={style.year}>
			<div className={style.yearIndicator}>{year}</div>
			<div className={style.ageIndicator} lang={lang.get(romanizedAge)}>
				{lang.text(romanizedAge)}
			</div>

			<div className={style.content}>
				{[...months].map(([month, events]) => (
					<Month events={events} key={month} month={month} />
				))}
			</div>
		</div>
	);
}

export default function Timeline() {
	// this spread is just because Intl.DateTimeFormat expects a mutable array.
	const locales = [...lang.useLocale()];

	const locale = Intl.DateTimeFormat.supportedLocalesOf(locales)[0];

	const years = React.useMemo(
		() =>
			groupBy(
				Immutable.List(Bio.Bio.timeline)
					.map(event => {
						// depending on locale there may be different numbers of months etc.
						const month: Immutable.FromJS<lang.Text<string>> =
							Immutable.fromJS<lang.Text<string>>([
								locale,
								Intl.DateTimeFormat(locale, {
									month: 'long',
								}).format(event.date),
							]);
						const year: Immutable.FromJS<lang.Text<string>> =
							Immutable.fromJS<lang.Text<string>>([
								locale,
								Intl.DateTimeFormat(locale, {
									year: 'numeric',
								}).format(event.date),
							]);

						return { ...event, month, year };
					})
					.sort((a, b) => +b.date - +a.date),
				v => v.year
			).map(v => groupBy(v, i => i.month)),
		[locale]
	);

	return (
		<>
			{[...years].map(([year, months], i) => (
				<Year key={lang.text(year)} months={months} year={year} />
			))}
		</>
	);
}
