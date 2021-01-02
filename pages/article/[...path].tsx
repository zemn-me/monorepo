import { useRouter } from 'next/router';
import * as articles from 'linear2/features/articles';
import * as next from 'next';
import style from './style.module.sass';
import Render from 'linear2/features/md/render';
import * as unist from 'unist';
import { articleBase } from '.';
import { makeYears, Timeline } from 'linear2/features/elements/timeline';

import * as bio from 'lib/bio';
import * as e from 'linear2/features/elements';

interface StaticPropsContext extends next.GetStaticPropsContext {
    params: {
        path: string[]
    }
}


export async function getStaticProps(context: StaticPropsContext) {
    const { content: ast } = await articles.Ast(...articleBase, ...context?.params?.path);
    const content = { props: {
        ...ast,
        edits: await articles.Edits(...articleBase, ...context?.params?.path),
        title: articles.getTitles(ast)[0] ?? { type: "text", value: "Untitled" }
    }};



    return JSON.parse(JSON.stringify(content));
}

export async function getRoutes() {
    return articles.In(...articleBase)
}



export const getStaticPaths: next.GetStaticPaths = async () => {
    return articles.pathsIn(...articleBase);
}


const writings = bio.timeline.filter(event =>
    event?.tags?.some( tag => tag == bio.writing )
).sort(({ date: a }, { date: b }) => (+a) - (+b));

const clamp = (v: number, min = -Infinity, max = Infinity) => {
    if (v < min) return min;
    if (v > max) return max;
    return v;
}

const lim = 30;

export default function Article(props: { content: unist.Node, title: unist.Node, edits: Date[] }) {
    const router = useRouter();
    const isInTimeline = writings.findIndex(e => 
        e.url &&
        e.url.hostname == "zemn.me" &&
        e.url.pathname == router.asPath
    );

    const timeline = isInTimeline == -1
        ? writings.slice(0, lim)
        : writings.slice(
            clamp(isInTimeline - lim, 0),
            clamp(isInTimeline + lim, writings.length - isInTimeline)
        )

    return <div className={style.ArticlePage}>
            <Timeline years={makeYears(timeline)} lang="en-GB" className={style.Timeline}
                indicateCurrent
            />
            <div className={style.Article}>
                <Render node={props.content}/>

                {props.title}{props.edits.length
                    ? <>, <e.date date={props.edits[0]}><e.dateText/></e.date>.</>
                    : null}{
                        props.edits.length > 1
                            ? <>Edited on {props.edits.map(
                                (d, i) => <e.date key={i} date={d}><e.dateText/></e.date>
                            )}</>
                            :""
                    }
            </div>


    </div>
}