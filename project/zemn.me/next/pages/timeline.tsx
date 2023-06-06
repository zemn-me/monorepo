import * as Bio from 'project/zemn.me/bio';
import Immutable from 'immutable';

/**
 * Given a map that contains a set, set a single item, expanding or creating
 * the set if needed.
 * @param v the map
 * @param key the key in the map
 * @param value the item to set
 * @returns the same map that was put in
 */
function setManyMap<K, V>(v: Immutable.Map<K, Immutable.Set<V>>, key: K, value: V): Immutable.Map<K, Immutable.Set<V>> {
    return v.set(key, v.get(key, Immutable.Set<V>()).add(value))
}

function groupBy<T, Q>(i: Iterable<T>, select: (v: T) => Q): Immutable.Map<Q, Immutable.Set<T>> {
    let m = Immutable.Map<Q, Immutable.Set<T>>();
    for (const v of i) m = setManyMap(m, select(v), v);

    return m;
}

const byYearByMonth = groupBy(Bio.Bio.timeline, t => t.date.getFullYear()).map(
    v => groupBy(v, e => e.date.getMonth())
        .toOrderedMap().sortBy(
            (_, k) => k,
            (a, b) => a-b
        )
).toOrderedMap().sortBy(
    (_, k) => k,
    (a, b) => a-b
);

export default function Timeline() {
    console.log(byYearByMonth.toJS());
    return JSON.stringify(byYearByMonth.toJS())
}


