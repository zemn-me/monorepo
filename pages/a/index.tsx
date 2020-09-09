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





export default E;