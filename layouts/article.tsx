import * as i8n from '@zemn.me/linear/i8n';
import * as jsx from '@zemn.me/linear/jsx';
import Head from 'next/head';
import style from './s.module.sass';
import * as indexer from '@zemn.me/linear/indexer'
import * as MDXProvider from '@zemn.me/linear/MDXProvider';
import React from 'react';
import { classes } from '@zemn.me/linear/classes';
import { A, Li, Ol, Nav, Ord, Prose, Section, Header, Main, Div, Heading } from '@zemn.me/linear';
import { PathNav } from '@zemn.me/linear/pathnav';
import { mustExpectedMeta } from 'lib/article';
import { SectionsProvider, SectionsContext, Record as SectionsRecord } from '@zemn.me/linear/sectiontracker';


interface IndexSectionProps {
    sections: readonly SectionsRecord[]
}

const IndexSection:
    (props: IndexSectionProps) => React.ReactElement
=
    ({ sections }) => <>
        {sections.map((s, i) => <>
            <Li key={i.toString()} {...{
                ...classes(
                    s.visible? style.IndexSectionVisible: style.IndexSection   
                )
            }}><a href={`#${s.id}`}>{s.title}</a>

            {s.children?.length?<Ol><IndexSection sections={s.children}/></Ol>:null}

            </Li>

        </>)}
    </>
;

export interface IndexProps {
    className?: string,
}

export const Index:
    (props: IndexProps) => React.ReactElement | null
=
    ({ className }) => {
        let sections = React.useContext(SectionsContext);

        // cull parent nodes from the sections
        // until there is more than one child
        while(sections.length == 1 && sections[0].children) sections = sections[0].children


        return <Nav {...{
            ...classes(className)  
        }}>
            <Ol>
                <IndexSection sections={sections}/>
            </Ol>
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
    tags?: readonly string[]
}

const M: React.FC = ({ children }) => {
    const index = React.useMemo(() => new indexer.Ctx, []);
    
    return <Main className={style.Main}>
        <MDXProvider.Provider>
            <SectionsProvider>
                {children}
            </SectionsProvider>
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
                        <Index/>
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
