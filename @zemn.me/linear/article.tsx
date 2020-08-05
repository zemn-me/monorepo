import React from 'react';
import * as elements from './elements';
import { MDXProvider } from '@mdx-js/react';

export interface Article {
    title: string,
    written: Date,
    children: React.ComponentType<import('@mdx-js/react').MDXProviderProps>
}

let fromEntries: typeof Object.fromEntries =
    Object.fromEntries ??
        (<T extends any = any>(entries: Iterable<readonly [PropertyKey, T]>) => {
            const o: any = {};   
            for (const [k, v] of entries) o[k] = v;
            return o;
        })



const components = fromEntries(Object.entries(elements).map( ([k, v]) => 
    [k[0].toLowerCase()+k.slice(1), v]
));



export const Article:
    (props: Article) => React.ReactElement
=
    ({ title, written, children: Component }) => <MDXProvider {...{
        components
    }}><Component {...{
        components: components as any
    }}/></MDXProvider>
;