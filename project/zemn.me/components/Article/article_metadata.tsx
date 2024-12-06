import { Metadata } from "next/types";

import { ArticleProps } from "#root/project/zemn.me/components/Article/types/article_types.js";
import { nativeDateFromUnknownSimpleDate } from "#root/ts/time/date.js";

export function articleMetadata({description, subtitle, title, date}: ArticleProps): Metadata {
	description = description ?? subtitle;
	return {
		title,
		description: description,
		openGraph: {
			type: 'article',
			publishedTime: nativeDateFromUnknownSimpleDate.parse(
				date
			).toISOString(),
			title: title,
			description: description,

		},
		twitter: {
			title,
			description,
			card: 'summary',
		},
	}
}
