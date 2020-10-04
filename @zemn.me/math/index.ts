import { N } from 'ts-toolbelt'
import * as matrix from '@zemn.me/math/matrix';
import * as vec from '@zemn.me/math/vec';

export interface Iterable<T, R = any, N = undefined> {
    [Symbol.iterator](): Iterator<T, R, N>
}

export const add:
    <B, O>(a: { add(B: B): O }, B: B) => O
=
    (a, b) => a.add(b)
;


export const mul:
    <B, O>(a: { mul(B: B): O }, B: B) => O
=
    (a, b) => a.mul(b)
;

const apply:
    <T>(f: (a: T, B: T) => T, ...b: T[]) => T
=
    (f, ...b) => {
        const [ first, ...etc] =  b;
        return etc.reduce((p, c) => f(p, c), first);
    }
;

abstract class Valued<T> {
    value: T
    constructor(v: T) { this.value = v }
    valueOf(): T { return this.value }
}

export class Num extends Valued<number> {
    add(n: Num): Num { return new Num(this.valueOf() + n.valueOf()) }

    mul(n: Num): Num
    mul<I extends number, V, O, T extends { mul(v: V): O }>(this: T, n: Vector<I, V>): Vector<I, O>

    // basically impossible to prove this
    // level of overloading to typescript so...
    mul(v: any): any { 
        if (v instanceof Num) return this.mulNum(v);
        if (v instanceof Vector) return this.mulVec(v);
    }

    private mulNum(v: Num): Num { return new Num(this.valueOf() * v.valueOf()) }
    private mulVec<I extends number, V, O, T extends { mul(v: V): O }>(this: T, n: Vector<I, V>): Vector<I, O> {
        return n.map(v => this.mul(v))
    }
}

export class Vector<I extends number, T> extends Valued<vec.Vector<I, T>> {
    map<U>(f: (v: T, i: number, a: Vector<I, T>) => U): Vector<I, U> {
        return new Vector(vec.map(this.valueOf(), (v, i, a) => f(v, i, this)))
    }

    add<V extends { add(B: T2): O }, O, T2>(this: Vector<I, V>, b: Vector<I, T2>): Vector<I, O> {
        return this.map((v, i) => add(v, b.valueOf()[i]))
    }

    mul<B, O extends { add(o: O): O }, I extends number, V extends { mul(b: B): O }>(this: Vector<I, V>, b: Vector<I, B>): O {
        return this.map((v, i) => mul(v, b.valueOf()[i])).sum()
    }


    sum<V extends { add(b: V): V }>(this: Vector<I, V>): V {
        return apply(add, ...this.valueOf() as vec.Vector<I, V>)
    }

    izip<T2>(v2: Vector<I, T2>): Iterable<readonly [ T, T2 ], Vector<I, readonly [ T, T2 ]>> {
        return { [Symbol.iterator]: () => new ZipVectorIterator([this, v2]) }
    }

    zip<T2>(v2: Vector<I, T2>): Vector<I, readonly [ T, T2 ]> {
        return this.map((v, i) => [ v, v2.valueOf()[i] ] as const );
    }

    get length() { return this.valueOf().length }

    [Symbol.iterator]() { return new VectorIterator(this) }
}

class ZipVectorIterator<I extends number, T1, T2>
    extends Valued<readonly [Vector<I, T1>, Vector<I, T2>]>
    implements Iterator<readonly [T1, T2], Vector<I, readonly [T1, T2]>> {

    private index: number = 0;
    private sequence: Array<readonly [T1, T2]> = [];
    private end: number;
    private finalVector: Vector<I, [T1, T2]> | undefined;

    constructor(v: readonly [Vector<I, T1>, Vector<I, T2>]) {
        super(v);
        this.end = v[0].length;
    }

    next() {
        if (this.index < this.end) {
            const r = [
                this.valueOf()[0].valueOf()[this.index],
                this.valueOf()[1].valueOf()[this.index]
            ] as const;

            this.sequence.push(r);

            this.index++;

            return { done: false, value: r } as const;
        }

        return { done: true, value: this.finalVector ?? (
            this.finalVector = new Vector<I, [T1, T2]>(this.sequence as any)
        )} as const
    }
}

class VectorIterator<I extends number, T> extends Valued<Vector<I, T>> {
   private index: number = 0; 
   next() {
       if (this.index < this.valueOf().length) {
           const r = this.valueOf().valueOf()[this.index];
            this.index++;
            return { done: false, value: r };
       }

       return { done: true, value: this.valueOf() }
   }
}

export class Matrix<I extends number, J extends number, T> extends Valued<matrix.Matrix<I, J, T>> {
    /**
     * Return the matrix as a sequence of vectors instead
     */
    asVectors(): Vector<J, Vector<I, T>> {
        return new Vector(this.valueOf()).map(v => new Vector(v))
    }

    add<V extends { add(V2: V2): O }, V2, O>(this: Matrix<I, J, V>, m2: Matrix<I, J, V2>): Matrix<I, J, O> {
        return new Matrix(
            this.asVectors().zip(m2.asVectors())
                .map(([a, b]) => a.zip(b).map(([a, b]) => a.add(b)).valueOf()).valueOf()
        );
    }

    /**
     * returns the row matrix corresponding to the given number
     */
    row(i: number): Matrix<I, 1, T> {
        return new Matrix([ this.valueOf()[i] ] as const)
    }

    /**
     * returns the column matrix corresponding to the given number
     */
    column(j: number): Matrix<1, J, T> {
        return new Matrix(this.asVectors().map(v => [v.valueOf()[j]] as const).valueOf())
    }

    nRows(): J {
        return this.valueOf().length
    }

    nColumns(): I {
        return this.valueOf()[0].length
    }

    mul<
        V2,
        O extends { add(O: O): O },
        I extends number,
        J extends number,
        I2 extends number,
        V extends { mul(v2: V2): O }
        >(this: Matrix<I, J, V>, m2: Matrix<I2, number, V2>):
        Matrix<I2, J, O> {

        const j1 = this.nRows();
        const i2 = m2.nColumns();

        return new Matrix(new Vector(vec.New<J>(j1)).map((_, i) =>
            new Vector(vec.New<I2>(i2))
                .map((_, j) =>
                    new Vector(this.row(i).valueOf()[0])
                        .mul<V2, O, I, V>(m2.column(j).asVectors().map(v => v.valueOf()[0]))
                ).valueOf()
            ).valueOf()
        );
    }


}

export { Num as Number }


