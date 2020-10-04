import * as matrix from '@zemn.me/math/matrix';
import * as math from '@zemn.me/math';
import React from 'react';
import { L } from 'ts-toolbelt';


type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

export class Percent extends math.Number {
    toString() { return `${this.valueOf()}%` }
}

export type Scalar = math.Number;
export type Path<L extends number = number, N = Scalar> = matrix.Matrix<2, L, N>;
export type Point<N = Scalar> = Path<1, N>;

export const Perc: (n: number) => Percent = n => new Percent(n);

export interface LineProps extends Omit<PropsOf<'line'>, 'x1'|'y1'|'x2'|'y2'|'path'> {
    path: Path
}

export const Line:
    (props: LineProps) => React.ReactElement
=
    ({ path: [ [ x1, y1], [x2, y2] ], ...props }) => <line {...{
        x1: x1.toString(), y1: y1.toString(), x2: x2.toString(), y2: y2.toString(),
        ...props
    }}/>
;

export interface TextProps extends Omit<PropsOf<'text'>, 'x' | 'y'>{
    pos: Point
}

export const Text:
    (props: TextProps) => React.ReactElement
=
    ({ pos: [[x, y]], ...props }) => <text {...{
        x: x.toString(),
        y: y.toString(),
        ...props
    }}/>
;

export const Matrix2Perc:
    <I extends number, J extends number>(v: matrix.Matrix<I, J, number>) => matrix.Matrix<I, J, Percent>
=
    v => matrix.map(v, v => Perc(v))
;

export const MatrixFromPerc:
    <I extends number, J extends number>(v: matrix.Matrix<I, J, Percent>) => matrix.Matrix<I, J, number>
=
    v => matrix.map(v, v => v.valueOf())
;

export const ReflectX:
    <L extends number>(v: Path<L>) => Path<L>
=
    <L extends number>(v: Path<L>): Path<L> => new math.Matrix(v).mul
        <Scalar, Scalar, 2, L, 2, math.Num>
    (new math.Matrix([
        [ new math.Number(1), new math.Number(0) ],
        [ new math.Number(0), new math.Number(-1) ]
    ] as const)).valueOf();
;