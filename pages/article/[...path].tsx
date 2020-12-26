
import * as articles from 'linear2/features/articles';
import * as next from 'next';
import style from './style.module.sass';
import Render from 'linear2/features/md/render';
import * as unist from 'unist';
import { articleBase } from '.';
import { makeYears, Timeline } from 'linear2/features/elements/timeline';

import * as bio from 'lib/bio';

interface StaticPropsContext extends next.GetStaticPropsContext {
    params: {
        path: string[]
    }
}


export async function getStaticProps(context: StaticPropsContext) {
    const content = { props: await articles.Ast(...articleBase, ...context?.params?.path) };

    return JSON.parse(JSON.stringify(content));
}

export async function getRoutes() {
    return articles.In(...articleBase)
}



export const getStaticPaths: next.GetStaticPaths = async () => {
    return articles.pathsIn(...articleBase);
}

export default function Article(props: { content: unist.Node }) {
    return <div className={style.ArticlePage}>
            <Timeline years={makeYears(bio.timeline.filter(event =>
                event?.tags?.some( tag => tag == bio.writing )
            ))} lang="en-GB" className={style.Timeline}
                indicateCurrent
            />
            <div className={style.Article}>
                <Render node={props.content}/>
            </div>

    </div>
}