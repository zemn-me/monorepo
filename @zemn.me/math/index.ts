import * as matrix from '@zemn.me/math/matrix';
import * as vec from '@zemn.me/math/vec';
import * as toolbelt from 'ts-toolbelt'

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

    zip<I2 extends number, T2, T3>(v2: Vector<I2, T2>, fb: T3):
        toolbelt.Number.Greater<
            toolbelt.Number.NumberOf<I>,
            toolbelt.Number.NumberOf<I2>
        > extends toolbelt.Boolean.True
            ? Vector<I, [ T | T3,  T2 | T3 ]>
            : Vector<I2, [ T | T3,  T2 | T3 ]> {

        let base = [];
        const [ a, b ] = [ this.valueOf(), v2.valueOf() ];
        const end = Math.max(a.length, b.length);

        for (let i = 0; i < end; i++) {
            base.push([ i < a.length? a[i]: fb, i < b.length? b[i]: fb ]);
        }

        return base as any;
    }



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

export class math {


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
    /*
    mul<
        I extends number, T1, T2, O
    >(this: CanMul<T1, T2, O> & CanAdd<O, O, O>, a: Vector<I, T1>, b: Vector<I, T2>):
        Vector<I, O> 
    */

    mul<
        I1 extends number, T1,
        I2 extends number, T2, O
    >(this: CanMul<T1, T2, O> & CanAdd<O, O, O>, a: Vector<I1, T1>, b: Vector<I2, T2>):
        toolbelt.Number.Greater<toolbelt.Number.NumberOf<I1>, toolbelt.Number.NumberOf<I2>> extends toolbelt.Boolean.True
            ? Vector<I1, O>
            : Vector<I2, O>

    mul(a: any, b: any) {
        if (isNumber(a) && isNumber(b)) return this.mulNum(a, b);

        if (a instanceof Vector && isNumber(b))
            return this.mulVecNum(a, b);

        if (isNumber(a) && b instanceof Vector)
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
        I extends number, T1,
        I2 extends number, T2, O
    >(this: CanMul<T1, T2, O> & CanSum<O>, a: Vector<I, T1>, b: Vector<I2, T2>):
        O {
        
        return a.zip(b, 
        return this.sum(a.map((a, pos) => this.mul(a, b.index(pos))))
    }

    private mulMatMat<
        I1 extends number, J1 extends number, T1,
        I2 extends number, J2 extends number, T2,
        O
    >(this: { mul(a: Vector<J1, T1>, b: Vector<I1, T2>): Vector<,
        a: Matrix<I1, J1, T1>, b: Matrix<I2, J2, T2>): Matrix<I2, J1, O> {

        return vec.map(vec.New<J1>(j1), (_, i) =>
            vec.map(vec.New<I2>(i2), (_, j) =>
            this.mul(
            vec.dot(row(m1, i), col(m2, j))
            
            ));
    }
}

