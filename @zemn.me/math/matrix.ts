import { Vector } from './vec';
import * as vec from './vec';

export interface Matrix<I extends number = number, J extends number = number, T = number> extends Vector<J, Vector<I, T>> {

}

export const as:
    <I extends number = number, J extends number = number, T = number>(v: (readonly((readonly T[]) & { length: I })[]) & { length: J }) => Matrix<I, J, T>
=
    v => v as any
;

export const add:
    <I extends number, J extends number>(m1: Matrix<I, J>, m2: Matrix<I, J>) => Matrix<I,J>
=
    <I extends number, J extends number>(m1: Matrix<I, J>, m2: Matrix<I, J>) =>
        vec.map(m1, (row, i) => vec.add(row, m2[i]))
;

export const row:
    <I extends number, J extends number, T>(v: Matrix<I, J, T>, r: number) => Iterable<T>
=
    function*(v, i) {
        const a = v[i];
        if (!a) return;
        for (let i = 0; i < a.length; i++) yield a[i];
    }
;


export const col:
    <I extends number, J extends number, T>(v: Matrix<I, J, T>, i: number) => Iterable<T>
=
    function*(v, i) {
        const [, jsize] = size(v);
        for (let j = 0; j < jsize; j++) yield v[j][i];
    }
;

export const mul:
    <I1 extends number, J1 extends number,
    I2 extends number, J2 extends number>(m1: Matrix<I1, J1>, m2: Matrix<I2, J2>) =>
        Matrix<I2, J1>
=
    <I1 extends number, J1 extends number, I2 extends number, J2 extends number>(
        m1: Matrix<I1, J1>,
        m2: Matrix<I2, J2>) => {
        const [i1, j1 ] = size(m1);
        const [i2, j2] = size(m2);

        return vec.map(vec.New<J1>(j1), (_, i) =>
            vec.map(vec.New<I2>(i2), (_, j) => vec.dot(row(m1, i), col(m2, j))));
    }
;

export const size:
    <I extends number, J extends number>(m: Matrix<I, J, any>) =>
        J extends 0? [undefined, J]: [I, J]
=
    m => [m[0]?.length, m.length] as any
;

export const transpose:
    <I extends number, J extends number>(m: Matrix<I, J>) => Matrix<J, I>
=
    <I extends number, J extends number>(m: Matrix<I, J>) => {
        const [i, j] = size(m)
        const rows = vec.New<I>(i);

        return vec.map(rows, (_, rj) => vec.map(vec.New<J>(j), (__, vi) => m[vi][rj]))
    }

;



