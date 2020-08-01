import React from 'react';
import classes from './classes';

type NewRsp<T extends string> = readonly [React.Context<T | true>, T]


export const New =
    <T extends string>(className: T): NewRsp<T> =>
        [React.createContext<T | true>(className), className] as const
    ;
    
export type UseClassProps<P extends { className?: string}> =
    P & { ctx: NewRsp<string>, children: React.ReactElement<P> }

/**
 * Conditionally use a class, but only if my parents are not already using it.
 */
export const UseClass:
    <P extends { className?: string }>(props: UseClassProps<P>) => React.ReactElement
    =
    ({ ctx: [ctx, className], children, ...childProps }) => {
        const v = React.useContext(ctx);
        console.log({ children });
        if (v == true) return <>{children}</>

        return <ctx.Provider value={true}>
            {React.cloneElement(children, {
                // existing props of the child
                ...children.props,
                // props set by our parent
                ...childProps,
                // our overridden props
                ...classes(className, children.props.className, childProps.className),
            })}
        </ctx.Provider>
    }
    ;