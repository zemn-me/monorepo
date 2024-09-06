import { Metadata } from 'next/types';

import { frontmatter } from '#root/mdx/article/2014/csp.js';
import Content from '#root/mdx/article/2014/csp.js'
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/zemn.me/components/Article/mdx_article.js';



export default function Page() {
	return <MDXArticle {...{frontmatter}}>
		<Content/>
	</MDXArticle>
}

export const metadata: Metadata = articleMetadata(frontmatter);
