import * as mdast from 'mdast';
import * as unist from 'unist';
import React from 'react';
import { Render, UnifiedNode, Elements } from '.';

export const text: React.FC<mdast.Text> = ({ value }) => <>{value}</>;


const del: React.FC<mdast.Delete> = nd =>
    <Render node={{ ...nd, type: "del" } as UnifiedNode}/>

export { del as delete };

export const thematicBreak: React.FC<mdast.ThematicBreak> = nd =>
    <Render node={{ ...nd, type: "hr" } as UnifiedNode}/>

export const paragraph: React.FC<mdast.Paragraph> = nd =>
    <Render node={{ ...nd, type: "p" }}/>

export const list: React.FC<mdast.List> = nd =>
    <Render node={{ ...nd, type: nd.ordered?"ol":"ul" }} />

export const listItem: React.FC<mdast.ListItem> = nd =>
    <Render node={{ ...nd,
        ...nd.checked == true || nd.checked == false
            ? { type: "li", children: [
                { type: "input", checked: nd.checked, fType: "checkbox" }
            ]}

            : { type: "li" }
        }}/>

export const linkReference: React.FC<mdast.LinkReference & mdast.Link> =
    p => React.createElement(link, p)

export const heading: React.FC<mdast.Heading> =
    ({ depth, ...etc }) => <Render node={{ ...etc, type: `h${depth}` }}/>

export const emphasis: React.FC<mdast.Emphasis> =
    nd => <Render node={{...nd, type: 'em'}}/>

export const inlineCode: React.FC<mdast.InlineCode> =
    nd => <Render node={{ ...nd, type: 'code', children: [
        { type: 'text', value: nd.value }
    ]} as UnifiedNode}/>

export const link: React.FC<mdast.Link> =
    ({ url: href, ...p }) => <Render node={{ ...p, type: 'a', href }}/>

export interface Footnotes extends unist.Node, unist.Parent {
    type: 'footnotes'
}

// this node was sneakily introduced by remark-footnotes. it's not
// to spec.
export const footnotes: (props: Footnotes) => React.ReactElement =
    nd => {
        const elements = React.useContext(Elements);

        return <Elements.Provider value={{
            footnoteDefinition: link,
            ...elements
        }}>
            <Render node={{...nd, type: 'aside',
                children: [{ type: 'ol', children:
                    nd.children.map(c => ({ type: 'li', children: [c]})) }],
            } as UnifiedNode}/>
        </Elements.Provider>
    }


export const definition: React.FC = () => null;

export interface FootnoteReference extends mdast.Parent, mdast.Association {
    type: 'footnoteReference'
}

export const footnoteReference: React.FC<FootnoteReference> = ({ identifier, label, ...etc }) =>
    <Render node={
        { ...etc, type: 'sup', children: [
            { type: 'a', href: `#fnref-${identifier}`, children: [
                { type: 'text', value: label }
            ]}
        ]} as UnifiedNode
    }/>
    
export const image: React.FC<mdast.Image> = nd =>
    <Render node={
        {
            ...nd,
            type: 'img',
            src: nd.url
        } as UnifiedNode
    }/>