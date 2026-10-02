import Content, {
	frontmatter,
} from '#root/mdx/article/2026/kasimir/kasimir.js';
import { articleMetadata } from '#root/project/me/zemn/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/me/zemn/components/Article/mdx_article.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return (
		<MDXArticle {...{ frontmatter }}>
			<Content />
		</MDXArticle>
	);
}

export const metadata: Metadata = articleMetadata(frontmatter);

export const handle = { metadata };
