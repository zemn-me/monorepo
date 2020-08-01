import React from 'react';

import { Article } from './article';
import article from '@zemn.me/article/how-to-hack-icloud';

export const _Article = () => <React.Suspense fallback={"hold on!"}>
    <Article {...{
        ...article,
        title: "test",
        written: new Date()
    }}/>
</React.Suspense>

export default {
    title: 'linear/Article',
    component: Article
}