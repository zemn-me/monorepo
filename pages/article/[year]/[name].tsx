import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router'
import { years } from '@zemn.me/article';
import Error from 'pages/error/[code]'
import { Article } from '@zemn.me/linear/archetype';
import { must } from '@zemn.me/linear/guard';

export interface DatedProps {
    date: Date
}

export const Dated:
    (props: DatedProps) => React.ReactElement
=
    ({ date }) => <>
        {date.getMonth()} {date.getFullYear()}
    </>
;

const X = () => {
    const { query: { year, name } } = useRouter();

    console.log(name, year);

    if (year == undefined || year instanceof Array ||
        name == undefined || name instanceof Array)
        return <Error code="404"/>


    const article = years?.[+year]?.[name];

    if (article == undefined) return <Error code="404"/>



    return <>
        <Head>
            <title>{article.title}</title>
        </Head>
        <Article>
        <></>
        <>
            <Dated date={must(article.date)}/>
            <article.Component/>
        </>
        </Article>
    </>

}

export default X;
