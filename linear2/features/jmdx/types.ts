
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

export interface Text {
    type: 'text'
    value: string
}

export interface Element {
    type: 'element'
    tagName: string
    properties: Record<string, string>
    children: Node[]
    position?: TextRange
}

export interface Root {
    type: 'root'
    children: Node[]
}

export interface Comment {
    type: 'comment'
    value: string
    position?: TextRange
}

export type Node = any

