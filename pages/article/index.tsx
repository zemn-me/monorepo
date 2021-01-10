import * as Articles from 'linear2/features/articles';
import Link from 'next/link';
import * as TreeList from 'linear2/features/elements/TreeList';
import * as next from 'next';
import style from './style.module.sass';
import Render from 'linear2/features/md/render';
import * as unist from 'unist';
import visit from 'unist-util-visit';



export const articleBase = [ "pages", "article" ] as const;

export async function getStaticProps() {
    const articles = await Articles.articlesAndPathsIn(...articleBase);
    const ret =  { props: { articles: articles }};

    return JSON.parse(JSON.stringify(ret)) as typeof ret;
}




type props = (ReturnType<typeof getStaticProps> extends Promise<infer Q>? Q: never)["props"];
export default function Dir(props: props) {
    let years = new Map();
    for (const article of props.articles) {
        years.set(article.params.path[0], (years.get(article.params.path[0])??[]).concat(article));
    }

    return <>
    {[...years.entries()].sort(([a], [b]) => -a.toString().localeCompare(b.toString())).map((a) => {
        const year: string = a[0];
        const articles = a[1];

        return <>
        <h2 key={year}>{year}</h2>
        <ol>
        {articles.map((a: any, i: any) => {
            return <li key={i}><Link href={`/article/${a.params.path?.join("/")}`}><a><Render node={a.title}/></a></Link></li>
        })}
        </ol>
        </>
    })}
    </>


    return <>{JSON.stringify(props)}</>
}