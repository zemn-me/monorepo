import { frontmatter as articleCsp } from '#root/mdx/article/2014/csp.js';
import { frontmatter as articleCors } from '#root/mdx/article/2019/cors/cors';
import { frontmatter as articleClean } from '#root/mdx/article/2024/clean.js';
import { frontmatter as articleMissing } from '#root/mdx/article/2024/missing.js';
import { frontmatter as articleKasimir } from '#root/mdx/article/2026/kasimir/kasimir.js';
import { nativeDateFromUnknownSimpleDate } from '#root/ts/time/date.js';

interface ArticleFrontmatter {
	readonly date?: unknown;
	readonly description?: string;
	readonly language?: string;
	readonly subtitle?: string;
	readonly title?: string;
}

interface ArticleSource {
	readonly frontmatter: ArticleFrontmatter;
	readonly href: string;
}

export interface ArticleIndexEntry {
	readonly dateTime: string;
	readonly description?: string;
	readonly href: string;
	readonly language: string;
	readonly publishedAt: Date;
	readonly title: string;
}

function article({ frontmatter, href }: ArticleSource): ArticleIndexEntry {
	if (frontmatter.title === undefined) {
		throw new Error(`Article at ${href} has no title.`);
	}

	const publishedAt = nativeDateFromUnknownSimpleDate.parse(frontmatter.date);
	const year = publishedAt.getFullYear();
	const month = String(publishedAt.getMonth() + 1).padStart(2, '0');
	const day = String(publishedAt.getDate()).padStart(2, '0');

	return {
		dateTime: `${year}-${month}-${day}`,
		description: frontmatter.description ?? frontmatter.subtitle,
		href,
		language: frontmatter.language ?? 'en-GB',
		publishedAt,
		title: frontmatter.title,
	};
}

export const articles: readonly ArticleIndexEntry[] = [
	article({
		frontmatter: articleKasimir,
		href: '/article/2026/kasimir',
	}),
	article({
		frontmatter: articleClean,
		href: '/article/2024/clean',
	}),
	article({
		frontmatter: articleMissing,
		href: '/article/2024/missing',
	}),
	article({
		frontmatter: articleCors,
		href: '/article/2019/cors',
	}),
	article({
		frontmatter: articleCsp,
		href: '/article/2014/csp',
	}),
].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
