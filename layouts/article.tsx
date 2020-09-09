import * as i8n from '@zemn.me/linear/i8n';
import Head from 'next/head';
import style from './s.module.sass';
import * as indexer from '@zemn.me/linear/indexer'
import MDXProvider from '@zemn.me/linear/MDXProvider';
import React from 'react';
import { classes } from '@zemn.me/linear/classes';
import { A, Nav, Ord, Prose, Section, Header, Main, Div, Heading } from '@zemn.me/linear';
import { PathNav } from '@zemn.me/linear/pathnav';

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
        <MDXProvider>
            <indexer.context.Provider value={index}>
                {children}
            </indexer.context.Provider>
        </MDXProvider>
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
            <Section className={style.Article}>
                <Prose>
                {article}
                </Prose>
            </Section>

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

interface YAMLObject {
    [key: string]: YAMLValue
}

interface YAMLArray extends ReadonlyArray<YAMLValue> {}

type YAMLValue = YAMLObject | number | string | YAMLArray | undefined

interface FrontMatter {
    [key: string]: YAMLValue
}

interface ExpectedMetadata extends YAMLObject {
    readonly layout: string,
    readonly title: string,
    readonly language: string,
    readonly subtitle?: string,
    readonly tags?: readonly string[],
    readonly author?: string
}

const isArrayOfStringsOrUndefined:
    (v: YAMLValue | undefined) => v is undefined | readonly string[]
=
    (v: YAMLValue | undefined): v is undefined | readonly string[] => {
        if (v == undefined) return true;
        if (!(v instanceof Array)) return false;
        if (!(v.every(((value): value is string => typeof value == "string"))))
            return false;

        return true;
    }
;

const layoutNotString = Symbol();
const titleNotString = Symbol();
const languageNotString = Symbol();
const subtitleNotUndefinedOrString = Symbol();
const authorNotUndefinedorString = Symbol();
const tagsNotArrayOfStringsOrUndefined = Symbol();

const symError:
    (v: { [key: string]: symbol }) => Error
=
    v => new Error(Object.keys(v)[0])
;

const mustExpectedMeta:
    (data: FrontMatter) => ExpectedMetadata
=
    data => {
        const { layout, title, language, subtitle, tags, author } = data;
        if (!(typeof layout == "string")) throw symError({ layoutNotString });
        if (!(typeof title == "string")) throw symError({ titleNotString })
        if (!(typeof language == "string")) throw symError({ languageNotString });
        if (subtitle !== undefined)
            if (!(typeof subtitle == "string")) throw symError({ subtitleNotUndefinedOrString });


        if (author !== undefined)
            if (!(typeof author == "string")) throw symError({ authorNotUndefinedorString });

        if (!isArrayOfStringsOrUndefined(tags)) throw symError({ tagsNotArrayOfStringsOrUndefined });

        return { layout, title, language, subtitle, tags, author }
    }
;

const X: 
    (frontmatter: FrontMatter) => React.FC<{
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
