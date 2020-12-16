import * as unist from 'unist';
import * as html from 'lib/unist-react/html';
import * as unify from 'lib/unist-react';
import * as mdast from 'lib/unist-react/mdastToHtml';
import React from 'react';


export const Render: (props: { node: unist.Node }) => React.ReactElement =
    ({ node }) => {
        const elements = React.useContext(unify.Elements);

        return <unify.Elements.Provider value={{
            ...elements,
            ...mdast,
            ...html
        } as any}>
            <unify.Render node={node as any} />
        </unify.Elements.Provider>
    }

export default Render;