import React from 'react';
import * as elements from './elements';
import * as indexer from './indexer';
import style from './archetype.module.sass';

export interface IndexProps {

}

export const Index:
    (props: IndexProps) => React.ReactElement | null
=
    () => {
        const ind = React.useContext(indexer.context);
        const [ index, setIndex ] = React.useState<indexer.Index>();


        React.useEffect(() => {
            if (!ind) return;
            const [destroy] = ind.onChange(setIndex);
            return destroy;
        }, [ ind, setIndex ]);

        if (!ind) return null;

        return <elements.Nav>

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
        localNav: React.ReactChild,
        content: React.ReactChild
    ]
}


export const Base:
    React.FC<KitchenSinkProps>
=
    ({ children: [localNav, content] }) => <>
        <PullDown>{localNav}{content}</PullDown>
</>
;

export const PullDown:
    React.FC
=
    ({ children }) => <>{children}</>
;