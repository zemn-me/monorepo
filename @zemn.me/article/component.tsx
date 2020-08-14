import articles from '.';
import { Header, Section, P } from '@zemn.me/linear/elements';
import React from 'react';

export const Articles = () => {
    const years = new Map<number, ArticleProps[]>();

    for (const article of articles) {
        if (article.date == undefined) throw new Error("missing date!");
        const year = article.date.getFullYear();
        years.set(year, [...years.get(year) || [], article]);
    }

    return <>
        {
            [...years.entries()].map(([year, articles]) => <Section key={year}>
                <Header>{year}</Header>
                {articles.map((article, i) => <Article {...article} key={i}/>)}
            </Section>)
        }
    </>
}

interface ArticleProps {
    medium?: URL,
    date?: Date,
    inShort?: string,
    title?: string
}

const Article:
    (props: ArticleProps) => React.ReactElement
=
    ({ date, inShort, title }) => {
        return <Section>
            <Header>{title ?? 'untitled'}</Header>
            <P>{inShort}</P>
        </Section>
    }
;

export default Articles;