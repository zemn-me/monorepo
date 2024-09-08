import { Metadata } from 'next/types';

import Content, { frontmatter } from '#root/mdx/article/2018/spotify.js'
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';
import { MDXArticle } from '#root/project/zemn.me/components/Article/mdx_article.js';



export default function Page() {
	return <MDXArticle {...{frontmatter}}>
		<Content/>
	</MDXArticle>
}

export const metadata: Metadata = articleMetadata(frontmatter);
