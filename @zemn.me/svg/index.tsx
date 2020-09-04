import * as matrix from '@zemn.me/math/matrix';
import React from 'react';


type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];


export interface LineProps extends Omit<PropsOf<'line'>, 'x1'|'y1'|'x2'|'y2'|'path'> {
    path: matrix.Matrix<2, 2>
}

export const Line:
    (props: LineProps) => React.ReactElement
=
    ({ path: [ [ x1, y1], [x2, y2] ], ...props }) => <line {...{
        x1, y1, x2, y2,
        ...props
    }}/>
;