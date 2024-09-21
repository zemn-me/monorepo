import { Metadata } from 'next/types';

import Content, { frontmatter } from '#root/mdx/article/2019/cors/cors.js';
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/zemn.me/components/Article/mdx_article';




export default function Page() {
	return <MDXArticle {...{frontmatter}}>
		<Content/>
	</MDXArticle>
}

export const metadata: Metadata = articleMetadata(frontmatter);

