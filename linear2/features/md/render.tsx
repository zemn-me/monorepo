import * as unist from 'unist';
import * as html from 'lib/unist-react/html';
import * as unify from 'lib/unist-react';
import * as mdast from 'lib/unist-react/mdastToHtml';
import * as Elements from 'linear2/features/elements/elements';
import React from 'react';
import Head from 'next/head';
import style from './style.module.sass';


export interface headProps extends Omit<PropsOf<"head">, 'children'> {
    children?: unist.Node[]
}

export const head: React.FC<headProps> = ({ children, ...props }) => {
    // the head element actually introspects the generated tree, meaning
    // we have to pre-generate all children of head
    return <Head {...props}>
        {children?.map(child => Render({ node : child as any }) ) ?? null}
    </Head>
}


export const Render: (props: { node: unist.Node }) => React.ReactElement =
    ({ node }) => {
        const elements = React.useContext(unify.Elements);

        return <unify.Elements.Provider value={{
            ...elements,
            ...mdast,
            ...html,
            head: head,
            Head: head,
            ...Elements,
            meta: html.element("meta", "name", "content"),
            comment: () => null,
            footnotes: (nd) => React.createElement(mdast["footnotes"], { ... nd, className: style.footnotes })
        } as any}>
            <unify.Render node={node as any} />
        </unify.Elements.Provider>
    }

export default Render;