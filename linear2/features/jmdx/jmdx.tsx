import { TextProps } from "@zemn.me/svg";
import React from 'react';



interface Pos {
    /** line number in file */
    line: number
    /** column on {@link line} */
    column: number
    /** position in bytes (?) from beginning of file */
    offset: number
}

interface TextRange {
    /** start of range in file */
    start: Pos
    /** end of range in file */
    end: Pos
}

interface Text {
    type: 'text'
    value: string
}

interface Element {
    type: 'element'
    tagName: string
    properties: Record<string, string>
    children: Node[]
    position?: TextRange
}

interface Root {
    type: 'root'
    children: Node[]
}

interface Comment {
    type: 'comment'
    value: string
    position?: TextRange
}

type Node = Element | Text | Root

function Root({ children }: Root) {
    return <Children nodes={children}/>
}

function Text({ value }: Text) {
    return <>{value}</>
}

export function Render(node: Node){
    switch (node.type) {
    case 'root':
        return <Root {...node}/>
    case 'element':
        return <Element {...node}/>
    case 'text':
        return <Text {...node}/>
    case 'comment': return null;
    default:
        return <>Unknown node of type: {(node as any).type}; {JSON.stringify(node)}</>
    }
}

function Children({ nodes }: { nodes: Node[] }) {
    return <>{ nodes.map((child, i) => <Render {...child} key={i} /> )}</>
}

interface Heading {
    type: 'element'
    properties: Record<string, string>
    children: Node[]
}

function Element(node: Element) {

    switch (node.tagName) {
    case 'heading':
        const { depth, ...props } = node.properties;
        return React.createElement(`h${depth}`, props, <Children nodes={node.children}/>);
    case 'thematicbreak': return <hr {...node.properties}/>
    case 'p':
    case 'section':
    case 'date':
        return React.createElement(node.tagName, node.properties,
            Children({nodes: node.children })
        )
    default: return <details style={{display: "inline"}}>
        <summary>
            Unknown element of type: {node.tagName}
        </summary>
        {JSON.stringify(node)}
    </details>;
    }
}

