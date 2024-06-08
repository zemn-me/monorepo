import { ReactElement } from "react"

export interface ArticleProps {
	readonly title?: string
	readonly subtitle?: string
	readonly date?: unknown
	readonly tags?: string[]
	readonly children?: ReactElement
	readonly description?: string
}

