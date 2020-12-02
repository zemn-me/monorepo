import React from 'react';
import mdast from 'mdast';
export const Paragraph = React.forwardRef<
    HTMLParagraphElement, JSX.IntrinsicElements["p"] & mdast.Paragraph>(
    ({ children, ...etc }, ref) => <p {...{ ref, ...etc }}>{children}</p>);

export const Text: (props: mdast.Text) => React.ReactElement = ({ value }) => <>{value}</>;

export const Blockquote = React.forwardRef<HTMLElement, JSX.IntrinsicElements["blockquote"] & mdast.Blockquote>(
    ({children, ...etc}, ref) =>
    <blockquote {...{ ref, ...etc}}>{children}</blockquote>);

export const Code = React.forwardRef<HTMLElement, JSX.IntrinsicElements["code"] & mdast.Code>(
    ({ children, value, lang, meta, ...etc}, ref) =>
        <code {...{ ...etc, ref}}>{value}{children}</code>
);

export const InlineCode = Code;

export const Image = React.forwardRef<HTMLImageElement, JSX.IntrinsicElements["img"] & mdast.Image>(
    ({ url, ...etc }, ref) =>
        <img {...{src: url, ref, ...etc}}/>
);

export const Break = React.forwardRef<HTMLBRElement, JSX.IntrinsicElements["br"] & mdast.Break>(
    ({ ...etc }, ref) => <br { ...{ ref, ...etc } }/>
);

export const Link = React.forwardRef<HTMLAnchorElement, JSX.IntrinsicElements["a"] & mdast.Link>(
    ({ type, url, children, ...etc }, ref) =>
        <a {...{ ref, ...etc, href: url }}>{children}</a>
);

export const List = React.forwardRef<
    HTMLOListElement | HTMLUListElement, (JSX.IntrinsicElements["ol"] | JSX.IntrinsicElements["ul"]) & mdast.List>(
        ({ ordered, start, spread, children, ...etc }, ref) => React.createElement(
            ordered? 'ol': 'ul',
            { start, ref, ...etc },
            children
        )
)

export const ListItem = React.forwardRef<
            HTMLLIElement, JSX.IntrinsicElements["li"] & mdast.ListItem>(
    ({ spread, children, ...etc }, ref) => <li {...{ ref, ...etc }}>{children}</li>
);