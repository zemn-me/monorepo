import { importMDX } from 'mdx.macro';
import React from 'react';
import { ReadonlyArticle as Article } from '../article';

const Document = React.lazy(() => importMDX('./psychiatry.mdx'));


const article: Article = {
    component: Document,
    keywords: ["mental health"],
    written: [28, "jul", 2020]
}

export default article;