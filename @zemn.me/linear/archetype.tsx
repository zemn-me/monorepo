import React from 'react'
import * as elements from './elements'
import * as indexer from './indexer'
import style from './archetype.module.sass'
import MDXProvider from './MDXProvider'
import classes from './classes'

export interface IndexItemProps {
	anchor: string
	title: string
	level: number
	node: Node
}

export const IndexItem: (props: IndexItemProps) => React.ReactElement = ({
	anchor,
	title,
	level,
}) => (
	<div
		{...{
			className: style.indexItem,
		}}>
		{title}
	</div>
)

export interface ArticleProps {
	children: [
		globalNav: React.ReactElement<{ className?: string }>,
		article: React.ReactElement,
	]
}

export interface KitchenSinkProps {
	children: readonly [
		globalNav: React.ReactElement<{ className?: string }>,
		localNav: React.ReactElement<{ className?: string }>,
		content: React.ReactElement<{
			className?: string
			ref: React.Ref<Pick<Element, 'scrollIntoView'>>
		}>,
	]
}

export const Base: React.FC<KitchenSinkProps> = ({
	children: [globalNav, localNav, content],
}) => (
	<>
		<MDXProvider>
			{globalNav}
			{localNav}
			{content}
		</MDXProvider>
	</>
)
