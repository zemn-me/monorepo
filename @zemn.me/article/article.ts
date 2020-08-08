import { SimpleDate }  from '@zemn.me/simpletime'
const { MDXProvider, mdx } = require("@mdx-js/react");

export interface Article {
    component: React.ComponentType
    keywords: string[]
    written: SimpleDate
}

export type ReadonlyArticle = {
    readonly [f in keyof Omit<Article, 'component'>]: Readonly<Article[f]>
} & Readonly<Pick<Article, 'component'>>