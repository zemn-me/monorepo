import { cloneElement, ReactElement } from 'react';

import { Article } from '#root/project/me/zemn/components/Article/article.js';
import {
	type MarkdownComponents,
	markdownComponents,
} from '#root/project/me/zemn/components/Article/markdown_components.js';

interface Frontmatter {
	layout?: string;
	title?: string;
	language?: string;
	subtitle?: string;
	tags?: string[];
	date?: [number, string, number];
	medium?: string;
}

interface MDXContentProps {
	components?: MarkdownComponents;
}

export interface MDXArticleProps {
	readonly frontmatter?: Frontmatter;
	readonly children: ReactElement<MDXContentProps>;
	readonly components?: MarkdownComponents;
}

export function MDXArticle(props: MDXArticleProps) {
	return (
		<Article {...props.frontmatter}>
			{cloneElement(props.children, {
				components: { ...markdownComponents, ...props.components },
			})}
		</Article>
	);
}
