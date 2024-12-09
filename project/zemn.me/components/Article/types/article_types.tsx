import { ReactElement } from "react"
import { z } from "zod"

import { nativeDateFromUnknownSimpleDate } from "#root/ts/time/date.js"

export const articleFrontmatter = z.object({
	title: z.string().optional(),
	subtitle: z.string().optional(),
	date: nativeDateFromUnknownSimpleDate.optional(),
	tags: z.string().array().optional(),
	url_safe_name: z.string().optional()
});

export interface ArticleProps {
	frontmatter: z.TypeOf<typeof articleFrontmatter>
}

export interface ArticleProps {
	readonly title?: string
	readonly subtitle?: string
	readonly date?: unknown
	readonly tags?: string[]
	readonly children?: ReactElement
	readonly description?: string
	readonly language?: string
}

