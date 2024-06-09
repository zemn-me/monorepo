import { Metadata } from 'next/types';

import { default as Content, frontmatter } from '#root/mdx/article/2019/cors/cors';
import { Article } from '#root/project/zemn.me/components/Article/article.js';
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';



export default function Page() {
	return <Article {...frontmatter}>
			<Content/>
	</Article>
}

export const metadata: Metadata = articleMetadata(frontmatter);

