import { Metadata } from 'next/types';

import { default as Content, frontmatter } from '#root/mdx/article/2014/csp';
import { Article } from '#root/project/zemn.me/app/article/article.js';
import { articleMetadata } from '#root/project/zemn.me/app/article/article_metadata.js';



export default function Page() {
	return <Article {...frontmatter}>
			<Content/>
	</Article>
}

export const metadata: Metadata = articleMetadata(frontmatter);
