import * as i8n from '@zemn.me/linear/i8n';
import * as jsx from '@zemn.me/linear/jsx';
import Head from 'next/head';
import style from './s.module.sass';
import * as indexer from '@zemn.me/linear/indexer'
import * as MDXProvider from '@zemn.me/linear/MDXProvider';
import React from 'react';
import { classes } from '@zemn.me/linear/classes';
import { A, Nav, Ord, Prose, Section, Header, Main, Div, Heading } from '@zemn.me/linear';
import { PathNav } from '@zemn.me/linear/pathnav';
import { mustExpectedMeta } from 'lib/article';

interface TOCNode {
    readonly id?: string
    readonly level: number
    readonly title: string
    readonly children: readonly TOCNode[]
}

export interface IndexProps {
    className?: string,
    tree: TOCNode[]
}


interface IndexSectionProps extends TOCNode { }

const IndexSection:
    (props: IndexSectionProps) => React.ReactElement
=
    ({ id, level, title, children}) => <>
        {self?<li><IndexSectionHeader {...{ title, anchor: title }}/></li>:null}
        {children&&children.length?<ol>
            {children.map((child, i) => <IndexSection key={i} {...child}/>)}
        </ol>:null}
    </>
;



export const Index:
    (props: IndexProps) => React.ReactElement | null
=
    ({ className, tree }) => {
        return <Nav {...{
            ...classes(className)  
        }}>
            <IndexSection {...tree[0]}/>
        </Nav>
    }
;


interface IndexSectionHeaderProps {
    title: string
    anchor: string
}

const IndexSectionHeader:
    (props: IndexSectionHeaderProps) => React.ReactElement
=
    ({ title, anchor }) => {
        const u = new URL(document.location!.toString());
        u.hash = anchor;
        return <A href={u}>{title}</A>
    }
;

interface PostProps {
    title: React.ReactElement
    subtitle?: React.ReactNode
    date: React.ReactElement
    article: React.ReactElement
    author?: React.ReactElement
    toc: TOCNode[]
    tags?: readonly string[]
}

const M: React.FC = ({ children }) => {
    const index = React.useMemo(() => new indexer.Ctx, []);
    
    return <Main className={style.Main}>
        <MDXProvider.Provider>
            <indexer.context.Provider value={index}>
                {children}
            </indexer.context.Provider>
        </MDXProvider.Provider>
    </Main>
}

const Post:
    (props: PostProps) => React.ReactElement
=
    ({ title, subtitle, date, article, author, tags }) => <M>
            <Header className={style.Header}>
                <div className={style.Sticker}>
                    <Div>
                        <PathNav/>
                    </Div>
                    <Heading>{title}</Heading>
                    {subtitle?<Div className={style.Subtitle}>{subtitle}</Div>:null}
                    {author?<Div className={style.Author}>{author}</Div>: null}
                    <Div className={style.Date}>{date}</Div>
                    {tags?<ul>
                        {tags.map(tag => <li key={tag}>{tag}</li>)}
                    </ul>: null}
                    <Div className={style.Index}>
                        {/*<Index {...{
                            tree: toc
                        }} />*/}
                    </Div>
                </div>
            </Header>
            <Div className={style.Article}>
                <Prose>
                    <MDXProvider.Prose>
                        {article}
                    </MDXProvider.Prose>
                </Prose>
            </Div>

    </M>
;

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




const X: 
    (frontmatter: jsx.FrontMatter) => React.FC<{
        date?: Date
    }>
=
    frontMatter => props => {

        const meta = mustExpectedMeta(frontMatter);

        const { children, date =  new Date(), ...etc } = props;

        console.log("metadata", { frontMatter, etc });
        return <>
            <Head>
                <title>{meta.title}</title>
            </Head>
            <Post {...{
                title: <>{meta.title}</>,
                subtitle: meta.subtitle?<>{meta.subtitle}</>: meta.subtitle,
                date: <i8n.Date {...{
                    date: date,
                    month: "long",
                    year: "numeric",
                    day: "numeric"
                }}/>,
                article: <>{children}</>,
                author: meta.author !== undefined? <>{meta.author}</>: meta.author,
                toc: [],
                tags: meta.tags
            }}/>
        </>
    }

export default X;
