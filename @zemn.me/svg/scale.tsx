import * as matrix from '@zemn.me/math/matrix';
import * as scale from 'd3-scale';
import * as axis from 'd3-axis';

export class Percent extends Number {
    toString(radix?: number | undefined) {
        return `${super.toString(radix)}%`
    }
}

type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

export const Transform = {
    HORIZONTAL: [ [ 1, 0 ], [0, 1] ],
    VERTICAL: [ [ 0, 1], [ 1, 0 ] ]
} as const;

