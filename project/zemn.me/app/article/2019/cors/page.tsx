import { Metadata } from 'next/types';

import content, { frontmatter } from '#root/mdx/article/2019/cors/cors';
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/zemn.me/components/Article/mdx_article';




export default function Page() {
	return <MDXArticle {...{frontmatter, content}}/>
}

export const metadata: Metadata = articleMetadata(frontmatter);

