import { Metadata } from 'next/types';

import * as Article from '#root/mdx/article/2014/csp';
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/zemn.me/components/Article/mdx_article.js';



export default function Page() {
	return <MDXArticle {...Article}/>
}

export const metadata: Metadata = articleMetadata(Article.frontmatter);
