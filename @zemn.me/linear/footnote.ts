import React from 'react'

export interface Footnote {
	id: string
	group: string
	text: string
	/** the symbol used to represent this footnote, e.g. '1' */
	symbol?: string
}

export interface IndexProps {
	/** footnote id */
	id: string
}

export interface Context {
	addFootnote(footnote: Footnote): IndexProps
}

export interface IndexContext {
	mappings: Record<string, Footnote>
}

export const Context = React.createContext<Context | undefined>(undefined)
