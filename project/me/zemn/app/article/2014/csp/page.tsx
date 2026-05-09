import Content, { frontmatter } from '#root/mdx/article/2014/csp.js';
import { articleMetadata } from '#root/project/me/zemn/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/me/zemn/components/Article/mdx_article.js';
import { Metadata } from '#root/ts/remix/index.js';

export default function Page() {
	return (
		<MDXArticle {...{ frontmatter }}>
			<Content />
		</MDXArticle>
	);
}

export const metadata: Metadata = articleMetadata(frontmatter);
