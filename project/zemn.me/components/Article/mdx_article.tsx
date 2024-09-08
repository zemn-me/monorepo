import { Editor } from '@monaco-editor/react';
import { cloneElement, ReactElement } from "react";

import { Article } from '#root/project/zemn.me/components/Article/article.js';
import { H1, H2, H3, H4, H5 } from '#root/project/zemn.me/components/Article/heading.js';
import { Section } from '#root/project/zemn.me/components/Article/section.js';
import Link from "#root/project/zemn.me/components/Link/Link.js";


interface Frontmatter {
	layout?: string;
	title?: string;
	language?: string;
	subtitle?: string;
	tags?: string[];
	date?: [number, string, number];
	medium?: string;
}

type MDXComponentTypes =
	"a" | "blockquote" | "code" | "em" |
	`h${1|2|3|4|5}` | "p" | "section" | "code" | "pre";

interface MDXContentProps {
	components?: {
		[k in MDXComponentTypes]?: (props:
			k extends keyof JSX.IntrinsicElements
				? JSX.IntrinsicElements[k]
				: never
		) => ReactElement | null
	}
}

export interface MDXArticleProps {
	readonly frontmatter?: Frontmatter
	readonly children: ReactElement<
		MDXContentProps
	>
}

interface CodeProps {
	readonly children?: string
	readonly className?: string
}

function Code(props: CodeProps) {
	const classes =
		new Set(props.className?.split(" ") ?? []);

	return <Editor
		defaultLanguage={[...classes].filter(
			v => v.startsWith('language-')
		)[0]}
		defaultValue={"ok"}
		height="90vh"
		options={{
			readOnly: true
		}}

	/>

}

export function MDXArticle(props: MDXArticleProps) {
	return <Article {...props.frontmatter}>
		{cloneElement(
			props.children,
			{
				components: {
					h1: H1,
					h2: H2,
					h3: H3,
					h4: H4,
					h5: H5,
					a: Link,
					section: Section,
					code: Code,
				}
			}
		)}
	</Article>
}
