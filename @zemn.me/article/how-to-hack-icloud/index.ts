import { importMDX } from 'mdx.macro';
import React from 'react';
import { ReadonlyArticle as Article } from '../article';

const Document = React.lazy(() => importMDX('./icloud.mdx'));

const article: Article = {
    component: Document,
    keywords: ["security", "disclosure"],
    written: [28, "jul", 2020]
};

export default article