import React, { Children } from 'react';
import * as jmdx from 'linear2/features/jmdx'
import * as html from '../html';

export type Node = any;

/**
 * RenderHtml turns mdast nodes that have an HTML analogue into their HTML analogue, and
 * renders them.
 */
export const Render:
    (props: jmdx.Node & { render: React.ReactElement<Node> }) => React.ReactElement
=
    ({ render, ...node }) => {
        const RootRender = React.useContext(jmdx.RootRendererContext);

        switch (node.type) {
        case 'footnotes': node = { ...node, type: `aside`,
        children: <RootRender {...{ type: 'ol', children: [
            { type: 'reactNode', value: node.children }
         ]}}/> }; break
        case 'heading': node = { ...node, type: `h${node.depth}` }; break
        case 'link': node = { ...node, type: 'a', href: node.url }; break
        case 'thematicBreak': node = {...node, type: 'hr'}; break
        case 'paragraph': node = {...node, type: 'p'}; break
        case 'linkReference': node = { ...node, type: 'a', href: node.url } ; break
        case 'list': node = { ...node, type: node.ordered? 'ol': 'ul', ordered: undefined }; break
        case 'listItem': node = { ...node, type: 'li' }; break
        case 'inlineCode': node = { ...node, type: 'code', children: <RootRender {...{
                type: 'text',
                value: node.value
            }}/>
         }; break
        case 'image': node = { ...node, type: 'img', src: node.url }; break
        case 'emphasis': node = { ...node, type: 'em' }; break
        case 'footnoteReference': node = {
                ...node, type: 'a', href: `fnref-${node.identifier}`,
                style: { fontSize: "small", verticalAlign: "super" },
                id: `fnref-backref-${node.identifier}`
            }; break
        case 'footnoteDefinition': node = {
                ...node, type: 'li',
                children: [
                    ...node.children,
                    <RootRender {...{
                        type: 'a',
                        href: `#fnref-backref-${node.identifier}`,
                        children: [ { type: 'text', value: '⮌' }],
                        ariaLabel: "to ref",
                        role: "img"
                    }}/>
                ]
            }; break
        }

        return <html.Render {...node}/>
    }
;
