import React, { Children } from 'react';
import * as jmdx from 'linear2/features/jmdx'
import mdast from 'mdast';
import * as util from 'linear2/features/jmdx/util';

export const Paragraph = React.forwardRef<
    HTMLParagraphElement, JSX.IntrinsicElements["p"] & mdast.Paragraph>(
    ({ children, ...etc }, ref) => <p {...{ ref, ...etc }}>{children}</p>);

export const Text: (props: mdast.Text) => React.ReactElement =
    function Text({ value }) { return <>{value}</> };

export const Blockquote = React.forwardRef<HTMLElement, JSX.IntrinsicElements["blockquote"] & mdast.Blockquote>(
    function Blockquoute({ type, children, ...etc}, ref) { 
        return <blockquote {...{ ref, ...etc}}>{children}</blockquote>
    });

export const ThematicBreak = React.forwardRef<HTMLHRElement, JSX.IntrinsicElements["hr"] & mdast.ThematicBreak>(
    function ThematicBreak ({ type, children, ...etc}, ref) {
        return <hr {...{ ref, ...etc}}>{children}</hr>
    }
)

export const Code = React.forwardRef<HTMLElement, JSX.IntrinsicElements["code"] & mdast.Code>(
    function Code ({ type, children, value, lang, meta, ...etc}, ref) {
        return <code {...{ ...etc, ref}}>{value}{children}</code>
    }
);

export const InlineCode = Code;

export const Image = React.forwardRef<HTMLImageElement, JSX.IntrinsicElements["img"] & mdast.Image>(
    function Image ({ type, url, ...etc }, ref) {
        return <img {...{src: url, ref, ...etc}}/>
    }
);

export const Break = React.forwardRef<HTMLBRElement, JSX.IntrinsicElements["br"] & mdast.Break>(
    function Break ({ type, ...etc }, ref){
        return <br { ...{ ref, ...etc } }/>
    }
);

export const Link = React.forwardRef<HTMLAnchorElement, JSX.IntrinsicElements["a"] & mdast.Link>(
    function Link ({ type, url, children, ...etc }, ref) {
        return <a {...{ ref, ...etc, href: url }}>{children}</a>
    }
);


export const List = React.forwardRef<
    HTMLOListElement | HTMLUListElement, (JSX.IntrinsicElements["ol"] | JSX.IntrinsicElements["ul"]) & mdast.List>(
        function List ({ type, ordered, start, spread, children, ...etc }, ref) {
            return React.createElement(
                ordered? 'ol': 'ul',
                { start, ref, ...etc },
                children
            )
        }
)

export const ListItem = React.forwardRef<
            HTMLLIElement, JSX.IntrinsicElements["li"] & mdast.ListItem>(
    function ListItem ({ type, spread, children, ...etc }, ref) {
        return <li {...{ ref, ...etc }}>{children}</li>
    }
);


type HtmlNode = any

/**
 * RenderHtml turns mdast nodes that have an HTML analogue into their HTML analogue.
 */
export const RenderHtml:
    (props: jmdx.Node & { render: React.ReactElement<HtmlNode> }) => React.ReactElement
=
    ({ render, ...node }) => {
        switch (node.type) {
        case 'link': node = { ...node, type: 'a', href: node.url }; break
        case 'linkReference': node = { ...node, type: 'a', href: node.url } ; break
        case 'list': node = { ...node, type: node.ordered? 'ol': 'ul' }; break
        case 'listItem': node = { ...node, type: 'li' }; break
        case 'inlineCode': node = { ...node, type: 'code' }; break
        case 'image': node = { ...node, type: 'img', src: node.url }; break
        case 'emphasis': node = { ...node, type: 'em' }; break
        case 'footnoteReference': node = {
                ...node, type: 'footnoteReference', href: `fnref-${node.identifier}`,
            }; break
        }

        return <util.RenderElement {...{
            element: render,
            props: node
        }}/>
    }
;