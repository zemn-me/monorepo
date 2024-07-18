"use client";
import { Metadata } from 'next/types';

import { frontmatter } from '#root/mdx/article/2019/cors/cors';
import ClientPage from '#root/project/zemn.me/app/article/2019/cors/client_page.js';
import { articleMetadata } from '#root/project/zemn.me/components/Article/article_metadata.js';



export default function Page() {
	return <ClientPage/>
}

export const metadata: Metadata = articleMetadata(frontmatter);

