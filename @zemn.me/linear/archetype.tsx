import React from 'react';
import * as elements from './elements';
import * as indexer from './indexer';
import PullDown from './pullDown';
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
        const [ index = [], setIndex ] = React.useState<indexer.Index>();


        React.useEffect(() => {
            if (!ind) return;
            const [destroy] = ind.onChange(setIndex);
            return destroy;
        }, [ ind, setIndex ]);


        return <elements.Nav {...{
            ...classes(className)  
        }}>
            { index.map(([anchor, title, level, node], i) => <React.Fragment key={i}>
                <IndexItem {...{anchor, title, level, node}}/>
            </React.Fragment>)}
        </elements.Nav>
    }
;

export interface ArticleProps {
    children: React.ReactElement
}

export const Article:
    (props: ArticleProps) => React.ReactElement
=
    ({ children }) => {
        const index = React.useMemo(() => new indexer.Ctx, []);
        return <indexer.context.Provider value={index}>
            <Base>
                <Index/>
                <elements.Article>
                    {children}
                </elements.Article>
            </Base>
        </indexer.context.Provider>
    }
;

export interface KitchenSinkProps {
    children: readonly [
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
    ({ children: [localNav, content] }) => <>
        <MDXProvider>
            <PullDown>{localNav}{content}</PullDown>
        </MDXProvider>
</>
;

