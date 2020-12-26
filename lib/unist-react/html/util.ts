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


export function e<N extends keyof JSX.IntrinsicElements>(t: N, ...k: (keyof JSX.IntrinsicElements[N])[]) {
    type P = JSX.IntrinsicElements[N];
    type T =
        P extends
            React.DetailedHTMLProps<any, infer Q>
            ? Q
            : P extends React.SVGProps<infer Z>
                ? Z
                : never;
    
    return React.forwardRef<T, P>((p, ref) => React.createElement(t,
        {ref, ...pick(p, ...k) }
    ));
}



export { e as element };

