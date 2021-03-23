import * as unist from 'unist';

export type Data = unist.Data

export interface Pos {
    /** line number in file */
    line: number
    /** column on {@link line} */
    column: number
    /** position in bytes (?) from beginning of file */
    offset: number
}

export interface TextRange {
    /** start of range in file */
    start: Pos
    /** end of range in file */
    end: Pos
}

export interface ElementProperties {
    [key: string]: string
}

export interface Nodes<Children, Data extends unist.Data = unist.Data> {}


export interface Parent<Children, Data extends unist.Data = unist.Data> extends unist.Node {
    children?: Children
}


export interface Nodes<Children, Data extends unist.Data = unist.Data>{ text: Text<Data> }
export interface Text<Children, Data extends unist.Data = unist.Data> extends Parent<undefined, Data> {
    type: 'text'
    value: string
    children?: undefined
    data?: Data
}

export interface Nodes<Children, Data extends unist.Data = unist.Data> { element: Element<Data> }
export interface Element<Children, Data extends unist.Data = unist.Data> extends Parent<Children, Data> {
    type: 'element'
    tagName: string,
    properties: Record<string, string>,
    children: Children,
    position?: TextRange
    data?: {
        // a name for the element
        hName?: string

        // properties of the element
        hProperties?: ElementProperties
    }
}


export interface Nodes<Children, Data extends unist.Data = unist.Data> { root: Root<Data> }
export interface Root<Children, Data extends unist.Data = unist.Data> extends Parent<Children, Data> {
    type: 'root'
    data?: Data
}

export interface Nodes<Children, Data extends unist.Data = unist.Data> { comment: Comment<Data> }
export interface Comment<Children, Data extends unist.Data = unist.Data> extends unist.Node {
    type: 'comment'
    value: string
    position?: TextRange
    children?: undefined
    data?: Data
}

export interface Nodes<Children, Data extends unist.Data = unist.Data> { reactNode: ReactNode<Data> }
export interface ReactNode<Children, Data extends unist.Data = unist.Data, P = unknown> extends Parent<Children, Data> {
    type: 'reactNode'
    value: React.ReactElement<P>
    //children?: Node
    children?: undefined
}

type Values<T> = T[keyof T]

export type Node<Children, Data extends unist.Data = unist.Data> = Values<Nodes<Data>>




