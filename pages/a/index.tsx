import { A, Nav, Ord, Prose, Section, Header, Main, Div, Heading } from '@zemn.me/linear';
import * as articles from '@zemn.me/article';
import style from './s.module.sass';
import * as indexer from '@zemn.me/linear/indexer'
import MDXProvider from '@zemn.me/linear/MDXProvider';
import React from 'react';
import { classes } from '@zemn.me/linear/classes';
import { useRouter } from 'next/router';



export interface IndexProps {
    className?: string
}


interface IndexSectionProps extends indexer.TreeNode { }

const IndexSection:
    (props: IndexSectionProps) => React.ReactElement
=
    ({self, children}) => <>
        {self?<li><IndexSectionHeader {...self}/></li>:null}
        {children&&children.length?<ol>
            {children.map((child, i) => <IndexSection key={i} {...child}/>)}
        </ol>:null}
    </>
;

export const Index:
    (props: IndexProps) => React.ReactElement | null
=
    ({ className }) => {
        const ind = React.useContext(indexer.context);
        let [ tree = {}, setTree ] = React.useState<indexer.TreeNode>();

        if (tree.children?.length == 1) tree = {
            children: tree.children[0].children
        }

        React.useEffect(() => {
            if (!ind) return;
            const [destroy] = ind.onChange(setTree);
            return destroy;
        }, [ ind, setTree ]);


        return <Nav {...{
            ...classes(className)  
        }}>
            <IndexSection {...tree}/>
        </Nav>
    }
;

const IndexSectionHeader:
    (props: indexer.RegisterProps) => React.ReactElement
=
    ({ title, anchor }) => {
        return <A href={new URL(
            `#${anchor}`, 
        )}>{title}</A>
    }
;

interface PostProps {
    title: React.ReactElement
    subtitle: React.ReactElement
    date: React.ReactElement
    article: React.ReactElement
    author: React.ReactElement
    wordCount: React.ReactElement
}

const Post:
    (props: PostProps) => React.ReactElement
=
    ({ title, subtitle, date, article, author }) => <M>
            <Header className={style.Header}>
                <div className={style.Sticker}>
                    <Heading>{title}</Heading>
                    <Div className={style.Subtitle}>{subtitle}</Div>
                    <Div className={style.Author}>{author}</Div>
                    <Div className={style.Date}>{date}</Div>
                    <Div className={style.Index}>
                        <Index/>
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



const E = () => <Post {...{
    title: <>How To Hack iCloud</>,
    subtitle: <>An exploration</>,
    date: <>September 12<Ord>th</Ord> 2020</>,
    article: <articles.y2020.icloud.Component/>,
    author: <>Thomas Neil James Shadwell</>,
    wordCount: <>5000</>
}}/>

export default E;