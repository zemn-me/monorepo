import React from 'react';
import * as elements from './elements';
import * as indexer from './indexer';
import style from './archetype.module.sass';
import MDXProvider from './MDXProvider'
import classes from './classes';

export interface IndexItemProps {
    anchor: string, title: string, level: number, node: Node
}

export const IndexItem:
    (props: IndexItemProps) => React.ReactElement
=
    ({ anchor, title, level }) => <div {...{
        className: style.indexItem
    }}>{title}</div>
;


export interface IndexProps {
    className?: string
}

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


        return <elements.Nav {...{
            ...classes(className)  
        }}>
            <IndexSection {...tree}/>
        </elements.Nav>
    }
;

const IndexSectionHeader:
    (props: indexer.RegisterProps) => React.ReactElement
=
    ({ title, anchor }) => <elements.A href={`#${anchor}`}>{title}</elements.A>
;

interface IndexSectionProps extends indexer.TreeNode {
}

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

export interface ArticleProps {
    children: [
        globalNav: React.ReactElement<{ className?: string }>,
        article: React.ReactElement
    ]
}

export const Article:
    (props: ArticleProps) => React.ReactElement
=
    ({ children: [ globalNav, article ] }) => {
        const index = React.useMemo(() => new indexer.Ctx, []);
        return <indexer.context.Provider value={index}>
            <Base>
                {globalNav}
                <Index/>
                <elements.Article>
                    {article}
                </elements.Article>
            </Base>
        </indexer.context.Provider>
    }
;

export interface KitchenSinkProps {
    children: readonly [
        globalNav: React.ReactElement<{ className?: string }>,
        localNav: React.ReactElement<{ className?: string}>,
        content: React.ReactElement<{
            className?: string,
            ref: React.Ref<Pick<Element, 'scrollIntoView'>>
        }>
    ]
}


export const Base:
    React.FC<KitchenSinkProps>
=
    ({ children: [globalNav, localNav, content] }) => <>
        <MDXProvider>
            {globalNav}{localNav}{content}
        </MDXProvider>
</>
;

