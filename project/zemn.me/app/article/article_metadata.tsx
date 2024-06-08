import { Metadata } from "next/types";

import { ArticleProps } from "#root/project/zemn.me/app/article/article_types.js";

export function articleMetadata(props: ArticleProps): Metadata {
	return {
		...props,
		description: props.subtitle ?? props.description
	}
}
