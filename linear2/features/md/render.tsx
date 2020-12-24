import * as unist from 'unist';
import * as html from 'lib/unist-react/html';
import * as unify from 'lib/unist-react';
import * as mdast from 'lib/unist-react/mdastToHtml';
import * as Elements from 'linear2/features/elements/elements';
import React from 'react';
import Head from 'next/head';


export const Render: (props: { node: unist.Node }) => React.ReactElement =
    ({ node }) => {
        const elements = React.useContext(unify.Elements);

        return <unify.Elements.Provider value={{
            ...elements,
            ...mdast,
            ...html,
            head: Head,
            ...Elements,
            meta: html.element("meta", "name", "content"),
            comment: () => null
        } as any}>
            <unify.Render node={node as any} />
        </unify.Elements.Provider>
    }

export default Render;