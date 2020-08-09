
export interface RegisterProps {
    /**
     * The section anchor, without the leading '#'
     */
    anchor: string

    title: string
}


export enum Event {
    Changed
}

export interface ContextType {
    Register(Props: RegisterProps): () => void
}