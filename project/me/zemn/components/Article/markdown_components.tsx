import type { ReactNode } from 'react';

import { CodeBlock } from '#root/project/me/zemn/components/Article/code_highlight.js';
import {
	H1,
	H2,
	H3,
	H4,
	H5,
} from '#root/project/me/zemn/components/Article/heading.js';
import { Section } from '#root/project/me/zemn/components/Article/section.js';
import Link from '#root/project/me/zemn/components/Link/index.js';

type MarkdownProps<Tag extends keyof JSX.IntrinsicElements> =
	JSX.IntrinsicElements[Tag] & { readonly node?: unknown };

export type MarkdownComponents = {
	readonly [Tag in keyof JSX.IntrinsicElements]?: (
		props: MarkdownProps<Tag>
	) => ReactNode;
};

// react-markdown supplies its syntax node; MDX supplies ordinary React props.
// Parser metadata must not leak into DOM attributes or shared UI components.
function elementProps<Props>({
	node: _node,
	...props
}: Props & { readonly node?: unknown }) {
	return props;
}

/** The site's element rendering defaults, shared by compiled MDX and runtime Markdown. */
export const markdownComponents = {
	a: (props: MarkdownProps<'a'>) => <Link {...elementProps(props)} />,
	h1: (props: MarkdownProps<'h1'>) => <H1 {...elementProps(props)} />,
	h2: (props: MarkdownProps<'h2'>) => <H2 {...elementProps(props)} />,
	h3: (props: MarkdownProps<'h3'>) => <H3 {...elementProps(props)} />,
	h4: (props: MarkdownProps<'h4'>) => <H4 {...elementProps(props)} />,
	h5: (props: MarkdownProps<'h5'>) => <H5 {...elementProps(props)} />,
	pre: (props: MarkdownProps<'pre'>) => (
		<CodeBlock {...elementProps(props)} />
	),
	section: (props: MarkdownProps<'section'>) => (
		<Section {...elementProps(props)} />
	),
} satisfies MarkdownComponents;
