import { Metadata } from 'next/types';

import { default as Content, frontmatter } from '#root/mdx/article/2014/csp';
import { Article } from '#root/project/zemn.me/components/Article/article';
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata';



export default function Page() {
	return <Article {...frontmatter}>
			<Content/>
	</Article>
}

export const metadata: Metadata = articleMetadata(frontmatter);
