import React from 'react';
import classes from './classes';

export type Context<T extends string> = readonly [React.Context<T | true>, T]


export const New =
    <T extends string>(className: T): Context<T> =>
        [React.createContext<T | true>(className), className] as const
    ;

export interface useClassProps<T extends string> {
    context: Context<T>,
    disabled?: boolean
}

const identity:
    <T>(v: T) => T
=
    v => v
;

/**
 * Use a class, but only if my parents are not already using it
 */
export const useClass:
    <T extends string>(props: useClassProps<T>) => [
        string[], (r: React.ReactElement) => React.ReactElement
    ]
=
    ({ context: [ctx, className], disabled = false }) => {
        const par = React.useContext(ctx);

        if (par == true || disabled) return [ [], identity ] ;

        return [[className], r => <ctx.Provider value={true}>{r}</ctx.Provider>];
    }
;