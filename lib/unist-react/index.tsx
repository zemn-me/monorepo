import * as unified from 'unified'
import * as unist from 'unist';
import * as hast from 'hast';
import React from 'react';

/**
 * @fileoverview unist-react is less of a library and more of a system for integrating
 * 'unified' ecosystem processors into a pipeline with react, and especially next.js.
 * 
 * It defines a methodology for turning unified ecosystem node trees into react component
 * trees. This works especially well with next.js's `getStaticProps`, which allows
 * pre-processing of arbitrary data into JSON-serializable props to be passed at runtime.
 * 
 * The unified ecosystem trees are defined to be JSON-serializable, so they're a great fit.
 */


function isReactElement(nd: Node): nd is React.ReactElement {
    return !(
        typeof nd == "object" &&
        nd !== null &&
        ("type" in nd) &&
        typeof nd.type == "string"
    )
}

function isHastElement(nd: Node): nd is hast.Element {
    return nd.type == "element"
}

export interface Parent extends Omit<unist.Parent, "children"> {
    type: unist.Parent["type"]
    children: unist.Parent["children"]
}

export interface ReactNode<P = any, T extends string | React.JSXElementConstructor<any> = string | React.JSXElementConstructor<any>> extends unist.Literal {
    type: 'react'
    children: undefined
    value: React.ReactElement<P, T>
}

export type ChildlessNode = unist.Node & { children : undefined }

export type Node = UnifiedNode | React.ReactElement
export type UnifiedNode = ChildlessNode | Parent | ReactNode

export type Data = unist.Data
export type Position = unist.Position
export type Point = unist.Point
export type Root = hast.Root

/**
 * The unist-react pipeline is composed of a sequence of
 * 1. Transforms and
 * 2. Bindings
 * 
 * which take Context provided node trees and either transform
 * them or render them
 */

const fallback: React.FC<Node> = nd => {
    console.error(`unable to render node of type ${nd.type}`);
    return <p>unable to render node of type {nd.type}</p>;
}

const reactElement: React.FC<ReactNode> = nd => <>{nd.value}</>;


export const RenderParent: React.FC<Parent> = ({ children }) =>
    <>{children.map((c, i) => <><Render node={c as UnifiedNode} key={i}/></>)}</>

export const Elements = React.createContext<Record<UnifiedNode["type"], React.FC<any>>>({
    react: reactElement,
    root: RenderParent
});

export const Fallback = React.createContext<React.FC<Node>>(fallback);
export const Render:
    (props: {node: Node }) => React.ReactElement
=
    ({ node }) => {
        const bindings = React.useContext(Elements);
        const fallback = React.useContext(Fallback);

        if (typeof node === "undefined") throw new Error("cannot render undefined tree");
        if (isReactElement(node)) return node;

        if (node.type == "element") {
            node = {
                ...node, ...node?.properties as object | undefined, ...((node?.data) as any)?.hProperties,
                properties: undefined, data: { ...node.data as object | undefined, hProperties: undefined },
                type: node.tagName
            } as
                UnifiedNode
        }

        return React.createElement(bindings[node.type] ?? fallback, {
            ...node,
            children: node?.children?.map(c => <Render node={c as Node}/>) ?? node.children as any
        });
    }
;




