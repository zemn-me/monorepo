
import * as mdast from './nodes/mdast';
import React from 'react';
export * from './types';
export * from './parse';
export * from './render';


export const Match:
    <P,T extends string | React.JSXElementConstructor<any>>(props:
        {
            props: { type: string, [key: string]: any },
            elements: Record<string, React.ReactElement<P,T>> ,
            fallback: React.ReactElement<P, T>
        }) => React.ReactElement<P, T>
    =
        ({ props, elements, fallback }) => {
            const element = props.type in elements? elements[props.type]: fallback;
            return React.cloneElement(element, { ...props, ...element.props }) as any;
        }
    ;

export { mdast };