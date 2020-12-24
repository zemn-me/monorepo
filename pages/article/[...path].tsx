
import * as articles from 'linear2/features/articles';
import * as next from 'next';
import style from './style.module.sass';
import Render from 'linear2/features/md/render';
import * as unist from 'unist';
import { articleBase } from '.';

interface StaticPropsContext extends next.GetStaticPropsContext {
    params: {
        path: string[]
    }
}


export async function getStaticProps(context: StaticPropsContext) {
    return { props: articles.Ast(...articleBase, ...context?.params?.path) };
}

export async function getRoutes() {
    return articles.In(...articleBase)
}



export const getStaticPaths: next.GetStaticPaths = async () => {
    return articles.pathsIn(...articleBase);
}

export default function Article(props: { content: unist.Node }) {
    return <div className={style.Article}>
        <Render node={props.content}/>
    </div>
}