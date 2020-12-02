import React from 'react';

/*

export const Text: (props: { children: string | number | null }) => React.ReactElement =
    ({ children }) => <>{children}</>;

export type CommentComponent = React.ComponentType<{ node: types.Comment }>
export type TextComponent = React.ComponentType<{ node: types.Text }>
export type ElementComponent = React.ComponentType<{ node: types.Element }>
export type Component = TextComponent | ElementComponent | CommentComponent
export type ElementOf<C extends React.ComponentType<any>> =
    C extends React.ComponentType<infer P>? React.ReactElement<P, C>: never;
export type RenderedElement = ElementOf<Component>

const quote: (v: string) => string = v => `\`${v.replace(/`/g, "\\`")}\``;

interface ElementConfig {
    comment?: React.ComponentType<{ node: types.Comment }>
    text?: React.ComponentType<{ node: types.Text }>
    elements: {
        [key: string]: React.ComponentType<{ children?: React.ReactNode, node: types.Element }>
    }

    unknown?: React.ComponentType<{ fragment: types.Node, elements: ElementConfig, children?: React.ReactNode }>
}

*/

export const Render
=
    ({ fragment, elements }) => {
        switch (fragment.type) {
        case "text": return <Text>{fragment.value}</Text>
        case "root": return <>{fragment.children.map((v, i) => <Render
            key={i} 
            fragment={v}
            elements={elements}
        />)}</>
        }

        const children = 
                fragment?.children?.map((child, i) => <Render key={i} elements={elements} fragment={child}/>);

        const element = getElementByName(fragment.tagName, elements.elements);
        if (element == undefined) {
            if (!elements.unknown) throw new Error(
                `element type ${quote(fragment.tagName)} not defined in element set. defined elements: ${
                    Object.keys(elements.elements).map(quote).join(", ")
                }`
            );
            return React.createElement(elements.unknown, { fragment, elements }, children);
        }


        return React.createElement(element, {
                node: fragment,
            },
            children
        )
    }
;

export default Render;