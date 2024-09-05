import { FC } from "react";

export const frontmatter: {
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
	`h${1|2|3|4|5}` | "p" | "section";

interface MDXContentProps {
	components?: {
		[k in MDXComponentTypes]?: FC<
			k extends keyof JSX.IntrinsicElements
				? JSX.IntrinsicElements[k]
				: never
			>
	}
}

declare const MDXContent: FC<MDXContentProps>

export default MDXContent
