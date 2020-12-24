import * as Articles from 'linear2/features/articles';
import * as TreeList from 'linear2/features/elements/TreeList';
import * as next from 'next';
import style from './style.module.sass';
import Render from 'linear2/features/md/render';
import * as unist from 'unist';
import visit from 'unist-util-visit';



export const articleBase = [ "pages", "article" ] as const;

export async function getStaticProps() {
    const articles = await Articles.astAndPathsIn(...articleBase);
    const withTitles = await Promise.all(articles.map(
        async ({ ast: astPromise, params: { path } }) => {
            const titles: unist.Parent[] = [];
            const ast = await astPromise

            visit(ast.content,
                node => node.type == 'heading' && node.depth == 1,
                node => titles.push({ type: 'root', children: node.children })
            );

            return { path, titles }
        })
    );


    const ret =  { props: { articles: withTitles }};

    return JSON.parse(JSON.stringify(ret));
}




type props = (ReturnType<typeof getStaticProps> extends Promise<infer Q>? Q: never)["props"];
export default function Dir(props: props) {
    return <>{JSON.stringify(props)}</>
}