import {
	default as Content,
	frontmatter,
} from '#root/project/me/zemn/app/experiments/article/testarticle.js';
import { Article } from '#root/project/me/zemn/components/Article/article.js';
import { articleMetadata } from '#root/project/me/zemn/components/Article/article_metadata.js';
import { Metadata } from '#root/ts/remix/metadata.js';

export default function Page() {
	return (
		<Article {...frontmatter}>
			<Content />
		</Article>
	);
}

export const metadata: Metadata = articleMetadata(frontmatter);

export const handle = { metadata };
