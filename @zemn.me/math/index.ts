import * as matrix from '@zemn.me/math/matrix';
import * as vec from '@zemn.me/math/vec';

export interface Iterable<T, R = any, N = undefined> {
    [Symbol.iterator](): Iterator<T, R, N>
}


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

/**
 * Classes that extend Number are assumed to be scalar forms.
 * It's abstract because you should just use `number` unless
 * you're doing something smart.
 */
export abstract class AbstractNumber extends Valued<number> { }
export type Number = number | AbstractNumber;

export const isNumber = (v: any): v is Number =>
    (typeof v == "number") ||
    (v instanceof Number);

export class Vector<I extends number, T> extends Valued<vec.Vector<I, T>> {
    map<U>(f: (v: T, i: number, a: Vector<I, T>) => U): Vector<I, U> {
        return new Vector(vec.map(this.valueOf(), (v, i, a) => f(v, i, this)))
    }

    index(i: number) { return this.valueOf()[i] }

    [Symbol.iterator]() { return this.valueOf()[Symbol.iterator]() }
}

export class Matrix<I extends number, J extends number, T> extends Valued<matrix.Matrix<I, J, T>> {
    map<U>(f: (v: T, pos: [i: number, j: number], a: Matrix<I, J, T>) => U): Matrix<I, J, U> {
        return new Matrix(vec.map(this.valueOf(), (row, i) =>
            vec.map(row, (cell, j) => f(cell, [i, j], this))));
    }

    index(i: number, j: number) { return this.valueOf()[i][j] }
}

type CanAdd<A, B, O> = { add(a: A, b: B): O };
type CanMul<A, B, O> = { mul(a: A, b: B): O };
type CanSum<T> = { sum(v: Vector<number, T>): T }

export class Math {


    // adding two vectors adds their components
    add<
        I extends number, T1,
        T2, O
    >(this: CanAdd<T1, T2, O>, a: Vector<I, T1>, b: Vector<I, T2>): Vector<I, O>

    // adding two matricies adds their components
    add<
        I extends number, J extends number, T1, T2, O
    >(this: CanAdd<T1, T2, O>, a: Matrix<I, J, T1>, b: Matrix<I, J, T2>): Matrix<I, J, O>

    // add a number, get a number
    add(a: Number, b: Number): number

    add(a: any, b: any) {
        if (a instanceof AbstractNumber && b instanceof AbstractNumber) return this.addNums(a, b);
        if (a instanceof Vector && b instanceof Vector) return this.addVecs(a, b);
        if (a instanceof Matrix && b instanceof Matrix) return this.addMatricies(a, b);
        if (typeof a == "number" && typeof b == "number") return this.addNums(a, b);
    }

    private addNums(a: number | Number, b: number | Number): number {
        return a.valueOf() + b.valueOf()
    }

    private addVecs<
        I extends number, T1,
        T2, O
    >(this: CanAdd<T1, T2, O>, a: Vector<I, T1>, b: Vector<I, T2>): Vector<I, O> {
        return a.map((v, i) => this.add(v, b.index(i)));
    }

    private addMatricies<
        I extends number, J extends number, T1, T2, O
    >(this: CanAdd<T1, T2, O>, a: Matrix<I, J, T1>, b: Matrix<I, J, T2>): Matrix<I, J, O> {
        return a.map((v, pos) => this.add(v, b.index(...pos)));
    }

    // sum a vector
    sum<T>(this: CanAdd<T, T, T>, v: Vector<number, T>) {
        const [ first, ...etc ] = v;

        return etc.reduce((p, c) => this.add(p, c), first);
    }
 
    // multiply numbers and numbers
    mul(a: Number, b: Number): number

    // multiply numbers and vectors
    // two defs because this is not a commutative operation
    // unless the subordinate, internal multiplication
    // operation is commutative
    mul<
        N extends Number, I extends number, T, O
    >(this: CanMul<T, N, O>, a: Vector<I, T>, b: N): Vector<I, O>

    mul<
        N extends Number, I extends number, T, O
    >(this: CanMul<N, T, O>, a: N, b: Vector<I, T>): Vector<I, O>

    // multiply numbers and matricies
    mul<
        N extends Number, I extends number, J extends number, T, O
    >(this: CanMul<N, T, O>, a: N, b: Matrix<I, J, T>): Matrix<I, J, O>

    mul<
        N extends Number, I extends number, J extends number, T, O
    >(this: CanMul<T, N, O>, a: Matrix<I, J, T>, b: N): Matrix<I, J, O>

    // multiply vectors (dot product)
    mul<
        I extends number, T1, T2, O
    >(this: CanMul<T1, T2, O> & CanAdd<O, O, O>, a: Vector<I, T1>, b: Vector<I, T2>):
        Vector<I, O> 

    mul(a: any, b: any) {
        if (isNumber(a) && isNumber(b)) return this.mulNum(a, b);

        if (isNumber(a) && b instanceof Vector)
            return this.mulVecNum(a, b);

        if (a instanceof Vector && isNumber(b))
            return this.mulNumVec(a, b);

        if (a instanceof Matrix && isNumber(b))
            return this.mulMatNum(a, b);
        
        if (isNumber(a) && b instanceof Matrix)
            return this.mulNumMat(a, b);

        if (a instanceof Vector && b instanceof Vector)
            return this.mulVec(a, b);

    }

    private mulNum(a: Number, b: Number): number {
        return a.valueOf() * b.valueOf()
    }

    private mulNumVec<
        B extends Vector<I, T>,
        N extends Number, I extends number, T,
    >(this: CanMul<N, T, T>, a: N, b: B): Vector<I, T> {
        return b.map(v => this.mul(a, v));
    }

    private mulVecNum<
        O,
        I extends number,
        N extends Number,
        T,
    >(this: CanMul<T, N, O>, a: Vector<I, T>, b: N): Vector<I, O> {
        return a.map(v => this.mul(v, b));
    }

    private mulNumMat<
        N extends Number, I extends number, J extends number, T, O
    >(this: CanMul<N, T, O>, a: N, b: Matrix<I, J, T>): Matrix<I, J, O> {
        return b.map(b => this.mul(a, b));
    }

   private mulMatNum<
        N extends Number, I extends number, J extends number, T, O
    >(this: CanMul<N, T, O>, a: Matrix<I, J, T>, b: N): Matrix<I, J, O> {
        return a.map(a => this.mul(b, a));
    }

    private mulVec<
        I extends number, T1, T2, O
    >(this: CanMul<T1, T2, O> & CanSum<O>, a: Vector<I, T1>, b: Vector<I, T2>):
        O {
        return this.sum(a.map((a, pos) => this.mul(a, b.index(pos))))
    }

    private _() {
        const x: Vector<2, number> =
            this.mulNumVec(1, new Vector<2, number>([1,2 as number] as const));
    }
}

type Assert<A extends B, B> = A;

const defaultMath = new Math();
export default defaultMath;

defaultMath.add(1, 2);
defaultMath.mul(1, 2);
defaultMath.mul(1, new Vector([1,2] as const));

/*
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
    asVectors(): Vector<J, Vector<I, T>> {
        return new Vector(this.valueOf()).map(v => new Vector(v))
    }

    add<V extends { add(V2: V2): O }, V2, O>(this: Matrix<I, J, V>, m2: Matrix<I, J, V2>): Matrix<I, J, O> {
        return new Matrix(
            this.asVectors().zip(m2.asVectors())
                .map(([a, b]) => a.zip(b).map(([a, b]) => a.add(b)).valueOf()).valueOf()
        );
    }

/
    row(i: number): Matrix<I, 1, T> {
        return new Matrix([ this.valueOf()[i] ] as const)
    }


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

*/



