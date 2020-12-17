import React from 'react';

export type Element<T extends string> = (T extends keyof JSX.IntrinsicElements
    ? JSX.IntrinsicElements[T]
    : {}) & { data?: unknown, position?: unknown, properties?: unknown }



export const pick:
    <I extends object, K extends keyof I>(i: I, ...k: K[]) =>
        Pick<I, K>
=
    (i, ...k) => k.reduce((a, c) => (a[c] = i[c], a), {} as any);
;


export const e:
    <T extends keyof JSX.IntrinsicElements>(t: T, ...pick: (keyof JSX.IntrinsicElements[T])[] ) =>
    React.FC<Element<T>>
=
    (t, ...k) => p => React.createElement(t, pick(p, ...k))
;

export { e as element };

