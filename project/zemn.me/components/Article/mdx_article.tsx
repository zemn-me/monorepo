import classNames from "classnames";
import React, { cloneElement, ReactElement, ReactNode } from "react";

import { Article } from '#root/project/zemn.me/components/Article/article.js';
import { H1, H2, H3, H4, H5 } from '#root/project/zemn.me/components/Article/heading.js';
import { Section } from '#root/project/zemn.me/components/Article/section.js';
import style from '#root/project/zemn.me/components/Article/style.module.css';
import Link from "#root/project/zemn.me/components/Link/index.js";


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
	"a" | "blockquote" | "code" | "em" | "section" | "img" |
	"article" | `${"o" | "u"}l` | "nav" | "li" | "time" | "hr" |
	`h${1|2|3|4|5}` | "p" | "section";

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

/*

const el = <T extends keyof JSX.IntrinsicElements>(element: T) =>
	(className?: string) =>
		({ children, ...props }: JSX.IntrinsicElements[T]) =>

			React.createElement(element, {
				...props,
				className: classNames(className, props.className)
			}, children );

*/

interface BasicProps {
	children?: ReactNode
	className?: string
}

const el =
  (className?: string) =>
	<T extends keyof JSX.IntrinsicElements | React.ComponentType<BasicProps>>(element: T) =>
    ({ children, ...props }: T extends keyof JSX.IntrinsicElements
      ? JSX.IntrinsicElements[T]
      : React.ComponentProps<T>) =>
      React.createElement(
        element,
        {
          ...props,
          className: classNames(className, props.className),
        },
        children
      );





const textBlock = el(
	classNames(
		style.padded
	)
);


const fullWidth = el(
	classNames(
		style.gridded,
		style.fullWidth
	)
)





export function MDXArticle(props: MDXArticleProps) {
	return <Article className={
		classNames(
			style.article, style.gridded
		)
	} {...props.frontmatter}>
		{cloneElement(
			props.children,
			{
				components: {
					h1: textBlock(H1),
					h2: textBlock(H2),
					h3: textBlock(H3),
					h4: textBlock(H4),
					h5: textBlock(H5),
					a: Link,
					section: fullWidth(Section),
					article: fullWidth("article"),
					blockquote: el(
						classNames(
							style.gridded,
							style.noMargin,
							style.padded,
						)
					)("blockquote"),
					li: fullWidth("li"),
					p: textBlock("p"),
					time: textBlock("time"),
					hr: textBlock("hr"),
					img: fullWidth("img"),

				}
			}
		)}
	</Article>
}
