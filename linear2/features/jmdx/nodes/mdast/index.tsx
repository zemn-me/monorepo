import React from 'react';
import mdast from 'mdast';
export const Paragraph = React.forwardRef<
    HTMLParagraphElement, JSX.IntrinsicElements["p"] & mdast.Paragraph>(
    ({ children, ...etc }, ref) => <p {...{ ref, ...etc }}>{children}</p>);

export const Text: (props: mdast.Text) => React.ReactElement =
    function Text({ value }) { return <>{value}</> };

export const Blockquote = React.forwardRef<HTMLElement, JSX.IntrinsicElements["blockquote"] & mdast.Blockquote>(
    function Blockquoute({children, ...etc}, ref) { 
        return <blockquote {...{ ref, ...etc}}>{children}</blockquote>
    });

export const ThematicBreak = React.forwardRef<HTMLHRElement, JSX.IntrinsicElements["hr"] & mdast.ThematicBreak>(
    function ThematicBreak ({ children, ...etc}, ref) {
        return <hr {...{ ref, ...etc}}>{children}</hr>
    }
)

export const Code = React.forwardRef<HTMLElement, JSX.IntrinsicElements["code"] & mdast.Code>(
    function Code ({ children, value, lang, meta, ...etc}, ref) {
        return <code {...{ ...etc, ref}}>{value}{children}</code>
    }
);

export const InlineCode = Code;

export const Image = React.forwardRef<HTMLImageElement, JSX.IntrinsicElements["img"] & mdast.Image>(
    function Image ({ url, ...etc }, ref) {
        return <img {...{src: url, ref, ...etc}}/>
    }
);

export const Break = React.forwardRef<HTMLBRElement, JSX.IntrinsicElements["br"] & mdast.Break>(
    function Break ({ ...etc }, ref){
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
        function List ({ ordered, start, spread, children, ...etc }, ref) {
            return React.createElement(
                ordered? 'ol': 'ul',
                { start, ref, ...etc },
                children
            )
        }
)

export const ListItem = React.forwardRef<
            HTMLLIElement, JSX.IntrinsicElements["li"] & mdast.ListItem>(
    function ListItem ({ spread, children, ...etc }, ref) {
        return <li {...{ ref, ...etc }}>{children}</li>
    }
);