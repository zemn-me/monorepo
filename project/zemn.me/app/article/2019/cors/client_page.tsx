"use client";

import { default as Content, frontmatter } from '#root/mdx/article/2019/cors/cors';
import { Article } from '#root/project/zemn.me/components/Article/article.js';



export default function ClientPage() {
	return <Article {...frontmatter}>
			<Content/>
	</Article>
}
