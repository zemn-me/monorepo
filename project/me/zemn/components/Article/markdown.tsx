import ReactMarkdown, { type Options } from 'react-markdown';

import {
	type MarkdownComponents,
	markdownComponents,
} from '#root/project/me/zemn/components/Article/markdown_components.js';

export interface MarkdownProps extends Omit<Options, 'components'> {
	readonly components?: MarkdownComponents;
}

/** Render runtime text with the same components as MDX, without executing JSX. */
export function Markdown({ components, ...props }: MarkdownProps) {
	return (
		<ReactMarkdown
			{...props}
			components={{ ...markdownComponents, ...components }}
		/>
	);
}
