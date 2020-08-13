import React from 'react';
import * as archetype from '@zemn.me/linear/archetype';
import { Nav } from 'pages';


export interface ArticleProps {
    children: React.ReactElement
}

export const Article:
    (props: ArticleProps) => React.ReactElement
=
    ({ children }) => <archetype.Article>
        <Nav/>
        {children}
    </archetype.Article>
;

const ind = () => <>hi</>;

export default ind;