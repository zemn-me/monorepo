import { Metadata } from 'next/types';

import { default as Content, frontmatter } from '#root/project/zemn.me/app/experiments/article/test.js';
import { Article } from '#root/project/zemn.me/components/Article/article.js';
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';



export default function Page() {
	return <Article {...frontmatter}>
			<Content/>
	</Article>
}

export const metadata: Metadata = articleMetadata(frontmatter);


