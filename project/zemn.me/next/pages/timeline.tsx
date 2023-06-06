import Immutable from 'immutable';
import * as Bio from 'project/zemn.me/bio';
import * as lang from 'ts/react/lang';

/**
 * Given a map that contains a set, set a single item, expanding or creating
 * the set if needed.
 * @param v the map
 * @param key the key in the map
 * @param value the item to set
 * @returns the same map that was put in
 */
function setManyMap<K, V>(
	v: Immutable.Map<K, Immutable.Set<V>>,
	key: K,
	value: V
): Immutable.Map<K, Immutable.Set<V>> {
	return v.set(key, v.get(key, Immutable.Set<V>()).add(value));
}

function groupBy<T, Q>(
	i: Iterable<T>,
	select: (v: T) => Q
): Immutable.Map<Q, Immutable.Set<T>> {
	let m = Immutable.OrderedMap<Q, Immutable.Set<T>>();
	for (const v of i) m = setManyMap(m, select(v), v);

	return m;
}

const byYearByMonth = groupBy(Immutable.List(Bio.Bio.timeline).map(
    event => {
        // depending on locale there may be different numbers of months etc.
        const locale ="ja-JP-u-ca-japanese";
        const month = Intl.DateTimeFormat(locale, { month: 'long' }).format(event.date);
        const year = Intl.DateTimeFormat(locale, { year: 'numeric'}).format(event.date);

        return {...event, month, year}
    }
).sort((a, b) => +b.date - +a.date), v => v.year).map(
    v => groupBy(v, i => i.month)
);

function Event({event: e}: {event: Bio.Event}) {
    return <div>
        <a href={e.url?.toString()} lang={lang.get(e.title)}>
            {lang.text(e.title)}
        </a>

        {" "}

        {
            e.description
                ?  <span lang={lang.get(e.description)}>
                    {lang.text(e.description)}
                </span>
                : null
        }
    </div>
}

function Month({month, events}: { month: string, events: Iterable<Bio.Event>}) {
    return <section>
        <header lang="en-GB">
        {month}
        </header>
        <ul>
        {
            [...events].map(e => <li key={""+e.date}><Event event={e}/></li>)
        }
        </ul>
    </section>
}

function Year({year, months}: {year: string, months: Iterable<[month: string, events: Iterable<Bio.Event>]> }) {
    return <section>
        <header lang="en-GB">
        {year}
        </header>

        {
            [...months].map(([month, events]) => <Month month={month} events={events} key={month}/>)
        }
    </section>
}

function History({years}: {years: Iterable<[ year: string, months: Iterable<[month: string, events: Iterable<Bio.Event>]>]> }) {
    return <>
        {
            [...years].map(([year, months]) => 
                <Year year={year} months={months} key={year}/>
            )
        }
    </>
}

export default function Timeline() {
    return <History years={byYearByMonth}/>
}
