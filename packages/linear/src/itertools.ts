

/**
 * Filter, but for iterators
 */
export const filter:
    <T, T2 extends T>(v: Iterable<T>, f: (i: T) => i is T2) =>
        Iterable<T2>
    =
    function* filter<T, T2 extends T>(i: Iterable<T>, fil: (i: T) => i is T2): Iterable<T2> {
        for (const val of i) {
            if (!fil(val)) continue;
            yield val;
        }
    }
    ;

/**
 * Return from the input iterator only unique values
 */
export const uniq:
    <T>(v: Iterable<T>) => Iterable<T>
    =
    function* uniq<T>(i: Iterable<T>): Iterable<T> {
        const seen = new Set();

        for (const value of i) {
            if (seen.has(value)) continue;
            seen.add(value);
            yield value;
        }
    }
    ;
