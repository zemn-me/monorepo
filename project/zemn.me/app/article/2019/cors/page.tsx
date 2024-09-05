import { Metadata } from 'next/types';

import { default as Content, frontmatter } from '#root/mdx/article/2019/cors/cors';
import { Article } from '#root/project/zemn.me/components/Article/article.js';
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';
import { H1, H2, H3, H4, H5 } from '#root/project/zemn.me/components/Heading/heading.js';
import { Section } from '#root/project/zemn.me/components/Section/section.js';



export default function Page() {
	return <Article {...frontmatter}>
		<Content
			// @ts-expect-error (mdx isn't really TS compliant)
			components={{
				h1: H1,
				h2: H2,
				h3: H3,
				h4: H4,
				h5: H5,
				section: Section,
			}}
		/>
	</Article>
}

export const metadata: Metadata = articleMetadata(frontmatter);

