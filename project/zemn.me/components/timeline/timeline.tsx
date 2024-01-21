'use client';
import Immutable from 'immutable';
import memoizee from 'memoizee';
import React, { ReactElement } from 'react';

import * as Bio from '#root/project/zemn.me/bio/index.js';
import Link from '#root/project/zemn.me/components/Link/index.js';
import { SectionLink } from '#root/project/zemn.me/components/SectionLink/SectionLink.js';
import style from '#root/project/zemn.me/components/timeline/timeline.module.css';
import * as lang from '#root/ts/react/lang/index.js';

interface MutableText {
	corpus: string;
	language: string;
}

type ImmutableText = Immutable.Record<MutableText>;

/**
 * Needed so that lang.TaggedText can be used as a key in a map.
 */
const Text = Immutable.Record<MutableText>(
	{
		corpus: '',
		language: 'Zzzz', // TR35 for unknown script https://unicode.org/reports/tr35/
	},
	'text'
);

function textToStringKey(t: ImmutableText): string {
	return [t.get('language'), t.get('corpus')].join('-');
}

/**
 * for a given set of strings, return the minimum number of
 * characters we can choose from the list to ensure that
 * each truncated string is unique.
 */
function shortestUniqueSample(strings: string[]): number {
	const maxLength = strings.reduce(
		(prev, current) => (current.length > prev ? current.length : prev),
		-Infinity
	);
	for (let i = 1; i < maxLength; i++) {
		const truncs = strings.map(v => v.slice(0, i));
		if (truncs.length === [...new Set(truncs)].length) return i;
	}

	throw new Error('oops');
}

const eventIdPrefixCount = memoizee(() =>
	shortestUniqueSample(Bio.Bio.timeline.map(v => v.id))
);

function shortIdForEvent(e: Bio.Event): string {
	return e.id.slice(0, eventIdPrefixCount());
}

interface CorpusProps {
	readonly children: lang.Text;
}

const sentanceTerminators = ['!', '.', '?', '…'];

function needsFullStop(text: lang.Text): boolean {
	if (text.locale.language !== 'en') return false;

	if (sentanceTerminators.some(v => text.text.endsWith(v))) return false;

	return true;
}

function fullStopIfNeeded(text: lang.Text): ReactElement | null {
	if (needsFullStop(text)) return <>.</>;

	return null;
}

/**
 * Injects the victorian title-dot if needed.
 * (it's a house-style thing I picked ages ago)
 * @see https://www.reddit.com/r/AskLiteraryStudies/comments/n8mmno/why_do_we_no_longer_use_periodsfull_stops_in/gxtfw1y
 */
function Corpus({ children: text }: CorpusProps) {
	return (
		<>
			{text.text}
			{fullStopIfNeeded(text)}
		</>
	);
}

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

const romanize = (n: number) => {
	const parts: string[] = [];
	while (n > 0) {
		for (const [value, sym] of numerals) {
			if (n < value) continue;
			parts.push(sym);
			n -= value;
			break;
		}
	}

	return parts.join('');
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

function Event({ event: e }: { readonly event: Bio.Event }) {
	return (
		<article className={style.event}>
			<Link href={e.url?.toString()} id={e.id} lang={lang.get(e.title)}>
				{e.title.text}
				{/* this would be a <Corpus> but it looks ugly with the full stop inside the link. */}
			</Link>
			{fullStopIfNeeded(e.title)}{' '}
			{e.description ? (
				<span lang={lang.get(e.description)}>
					<Corpus>{e.description}</Corpus>
				</span>
			) : null}{' '}
			<SectionLink href={`#${e.id}`}>§{shortIdForEvent(e)}.</SectionLink>
		</article>
	);
}

function Month({
	month,
	events,
}: {
	readonly month: ImmutableText;
	readonly events: Iterable<Bio.Event>;
}) {
	return (
		<div className={style.month}>
			<header className={style.monthName} lang={month.get('language')}>
				<Corpus>
					{lang.Text(month.get('language'), month.get('corpus'))}
				</Corpus>
			</header>
			<div className={style.content}>
				{[...events].map((e, i) => (
					<Event event={e} key={i} />
				))}
			</div>
		</div>
	);
}

function Year({
	year,
	months,
}: {
	readonly year: ImmutableText;
	readonly months: Immutable.OrderedMap<
		ImmutableText,
		Immutable.List<Bio.Event>
	>;
}) {
	const firstItem = months.first()?.first();
	const fullYear = firstItem?.date.getFullYear() ?? 0;
	return (
		<div className={style.year}>
			<div className={style.yearIndicator} lang={year.get('language')}>
				{year.get('corpus')}
			</div>
			{/*↓ unicode for 'no specified language, roman numerals used for numbering'*/}
			<div className={style.ageIndicator} lang="zxx-u-nu-romanlow">
				{romanize(fullYear - 1994)}
			</div>

			<div className={style.content}>
				{[...months].map(([month, events]) => (
					<Month
						events={events}
						key={textToStringKey(month)}
						month={month}
					/>
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
						const month: ImmutableText = Text({
							corpus: Intl.DateTimeFormat(locale, {
								month: 'long',
							}).format(event.date),
							language: locale,
						});
						const year: ImmutableText = Text({
							corpus: Intl.DateTimeFormat(locale, {
								year: 'numeric',
							}).format(event.date),
							language: locale,
						});

						return { ...event, month, year };
					})
					.sort((a, b) => +b.date - +a.date),
				v => v.year
			).map(v => groupBy(v, i => i.month)),
		[locale]
	);

	return (
		<>
			{[...years].map(([year, months]) => (
				<Year key={textToStringKey(year)} months={months} year={year} />
			))}
		</>
	);
}
