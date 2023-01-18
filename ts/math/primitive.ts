
/**
 * @fileoverview basic primitives for typesafe maths.
 */
export class Tuple<T, A extends T[] = T[]> extends Array<T> implements ReadonlyArray<T> {
    get length(): A["length"] { return super.length }
    constructor(...a: A) {
        super(...a)
    }

    static fromIterable<T>(v: Iterable<T>): Tuple<T> {
        return new Tuple(...v);
    }


    /**
     * Calls a defined callback function on each element of an array, and returns an array that contains the results.
     * @param callbackfn A function that accepts up to three arguments. The map method calls the callbackfn function one time for each element in the array.
     */
    map<U>(callbackfn: (value: T, index: number, array: this) => U) {
        return new Tuple<U, U[] & { length : A["length" ] }>(...super.map((value, index) => callbackfn(value, index, this)))
    }
}
