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
	"h1" | "h2" | "p" | "section";

type MDXContentProps = {
	[k in keyof MDXComponentTypes]: FC
}

declare const MDXContent: FC<MDXContentProps>

export default MDXContent
