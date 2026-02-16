import { Metadata } from 'next/types';

import Content, { frontmatter } from '#root/mdx/article/2019/cors/cors';
import { articleMetadata } from '#root/project/me/zemn/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/me/zemn/components/Article/mdx_article';




export default function Page() {
	return <MDXArticle {...{frontmatter}}>
		<Content/>
	</MDXArticle>
}

export const metadata: Metadata = articleMetadata(frontmatter);

