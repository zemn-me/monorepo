import { Metadata } from 'next/types';
import Content, {
	frontmatter,
} from '#root/mdx/article/2026/mandarin-bench/mandarin-bench.js';
import { articleMetadata } from '#root/project/me/zemn/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/me/zemn/components/Article/mdx_article.js';

import { MandarinBenchChart } from './chart.js';

export default function Page() {
	return (
		<MDXArticle
			components={{
				MandarinBenchChart,
			}}
			{...{ frontmatter }}
		>
			<Content />
		</MDXArticle>
	);
}

export const metadata: Metadata = articleMetadata(frontmatter);
