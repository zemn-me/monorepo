/* eslint-disable jsx-a11y/heading-has-content, jsx-a11y/anchor-has-content */

import React from 'react';
import style from './style';
import classes from './classes';
import * as classProvider from './classprovider';
import * as env from './env';
import * as indexer from './indexer';
import { useProvideSection } from './indexer';
import { fromEntries } from './fromEntries';
import { MDXProvider } from '@mdx-js/react';

type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

interface DarkMode {
    dark?: boolean;
}

const linearClassContext = classProvider.New(style.linear);
const darkModeClassContext = classProvider.New(style.darkmode);

/**
 * These are special props which propagate to children via context.
 */
interface LinearGlobals extends DarkMode { }

/**
 * These props are added to all linear elements
 */
interface LinearProps extends LinearGlobals { }

const Wraps = '__wraps_component_' as const;


export type LinearifyProps<P extends { className?: string }> =
    { [Wraps]: React.ReactElement<P> } & P & LinearProps

const Linearify:
    <P extends { className?: string }>(props: LinearifyProps<P>) => React.ReactElement
=
    ({ [Wraps]: children, dark, ...extraProps }) => {
        const [ classes1, wrap1 ] = classProvider.useClass({
            context: linearClassContext  
        });

        const [ classes2, wrap2 ] = classProvider.useClass({
            context: darkModeClassContext,
            disabled: !dark
        });

        return wrap1(wrap2(
            React.cloneElement(children, {
                ...children.props,
                ...extraProps,
                ...classes(children.props.className, ...classes1, ...classes2),
            })
        ))

    }
;

const L = Linearify;

export interface DivProps extends PropsOf<'div'>, LinearProps { }

export const Div:
    (props: DivProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <div/>,
        ...props
    }}/>


export interface PProps extends PropsOf<'p'>, LinearProps { }

export const P:
    (props: PProps) => React.ReactElement
    =

    props => <L {...{
        [Wraps]: <p/>,
        ...props
    }}/>

export interface InputProps extends PropsOf<'input'>, LinearProps { }

export const Input:
    (props: InputProps) => React.ReactElement
    = props => <L {...{
        [Wraps]: <input/>,
        ...props
    }}/>

export interface H1Props extends PropsOf<'h1'>, LinearProps { }

export const H1:
    (props: H1Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <H1Impl/>,
        ...props
    }}/>


const H1Impl:
    (props: H1Props) => React.ReactElement
=
    props => {
        const [ref, title] = useProvideSection(1);

        return <h1 {...{
            id: title,
            ...props
        }} ref={ref}></h1>
    }
;

export interface H2Props extends PropsOf<'h2'>, LinearProps { }

export const H2:
    (props: H2Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <H2Impl/>,
        ...props
    }}/>
    ;

const H2Impl:
    (props: H2Props) => React.ReactElement
=
    props => {
        const [ref, title] = useProvideSection(2);

        return <h2 {...{
            id: title,
            ...props
        }} ref={ref}></h2>
    }
;




export interface H3Props extends PropsOf<'h3'>, LinearProps { }

export const H3:
    (props: H3Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <H3Impl/>,
        ...props
    }}/>

const H3Impl:
    (props: H3Props) => React.ReactElement
=
    props => {
        const [ref, title] = useProvideSection(3);

        return <h3 {...{
            id: title,
            ...props
        }} ref={ref}></h3>
    }
;



export interface H4Props extends PropsOf<'h4'>, LinearProps { }

export const H4:
    (props: H4Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <h4/>,
        ...props
    }}/>

export interface H5Props extends PropsOf<'h5'>, LinearProps { }

export const H5:
    (props: H5Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <h5/>,
        ...props
    }}/>
    ;

export interface StrongProps extends PropsOf<'strong'>, LinearProps { }

export const Strong:
    (props: StrongProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <strong/>,
        ...props
    }}/>

export interface EmProps extends PropsOf<'em'>, LinearProps { }

export const Em:
    (props: EmProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <em/>,
        ...props
    }}/>
    ;

export interface SpanProps extends PropsOf<'span'>, LinearProps { }

export const Span:
    (props: SpanProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <span/>,
        ...props
    }}/>

    ;

export interface HrProps extends Omit<PropsOf<'hr'>, 'children'>, LinearProps { }

export const Hr:
    (props: HrProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <hr/>,
        ...props
    }}/>
    ;

export interface MainProps extends PropsOf<'main'>, LinearProps { }

export const Main:
    (props: MainProps) => React.ReactElement
    =
    ({ className, ...props }) => <L {...{
        [Wraps]: <main/>,
        ...props
    }}/>
    ;

export interface AProps extends PropsOf<'a'>, LinearProps { }

const trimLink:
    (link: string, origin?: string, protocol?: string) => string
    =
    (
        link,
        origin = env.origin,
        protocol = env.protocol) => {

        if (link.startsWith(origin))
            return link.slice(origin.length);

        if (link.startsWith(protocol))
            return link.slice(protocol.length);

        return link;
    }

    ;

export const A:
    (props: AProps) => React.ReactElement
    =
    ({ href, ...props }) => <L {...{
        [Wraps]: <a {...{
            href: href? trimLink(href): href,
        }}/>,
        ...props
    }}/>
 

export interface TimeProps extends Omit<PropsOf<'time'>, 'dateTime'>, LinearProps {
    dateTime?: Date | PropsOf<'time'>["dateTime"]
}

export const Time:
    (props: TimeProps) => React.ReactElement
    =
    ({ dateTime, ...props }) => <L {...{
        [Wraps]: <time {...{
                dateTime: dateTime instanceof Date ?
                    dateTime.toDateString() : dateTime
            }} />,
            dark: true,
            ...props
    }}/>

    ;

export interface LiProps extends PropsOf<'li'>, LinearProps {}

export const Li:
    (props: LiProps) => React.ReactElement
=
    props => <L {...{
        [Wraps]: <li/>,
        ...props
    }}/>
;

export interface UlProps extends PropsOf<'ul'>, LinearProps {}

export const Ul:
    (props: UlProps) => React.ReactElement
=
    props => <L {...{
        [Wraps]: <ul/>,
        ...props
    }}/>
;

export interface OlProps extends PropsOf<'ol'>, LinearProps {}

export const Ol:
    (props: OlProps) => React.ReactElement
=
    props => <L {...{
        [Wraps]: <ol/>,
        ...props
    }}/>
;

const components = fromEntries(Object.entries(import('@zemn.me/linear/elements')).map( ([k, v]) => 
    [k[0].toLowerCase()+k.slice(1), v]
));


export interface ArticleProps extends PropsOf<'article'>, LinearProps {}

export const Article:
    (props: ArticleProps) => React.ReactElement
=
    props => <L {...{
        [Wraps]: <ArticleImpl/>,
        ...props
    }}/>
;

const ArticleImpl:
    (props: ArticleProps) => React.ReactElement
=
    ({ children, ...props}) => {
        return <article {...props}>
            {/*
                could do this type safe but not in this file
                w/o a cyclic import...
            */}
            <MDXProvider components={components}>
                {children}
            </MDXProvider>
        </article>
    }
;

export interface PreProps extends PropsOf<'pre'>, LinearProps {}

export const Pre:
    (props: ArticleProps) => React.ReactElement
=
    props => <L {...{
        [Wraps]: <pre/>,
        ...props
    }}/>
;

export interface IndexProps {
    children: React.FC<{
        index?: indexer.Index
    }>
}

const sectionDepthContext = React.createContext<number>(0);

export interface SectionProps extends PropsOf<'section'>, LinearProps {}

export const Section:
    (props: SectionProps) => React.ReactElement
=
    ({ ...props }) => {
        const depth = React.useContext(sectionDepthContext);

        return <sectionDepthContext.Provider value={depth+1}>
            <L {...{
                [Wraps]: <section/>,
                ...props
            }}/>
        </sectionDepthContext.Provider>
    }
;

export interface HeaderProps extends PropsOf<'h1'>, LinearProps {
    children: [
        title: React.ReactChild,
        ...etc: React.ReactChild[]
    ] | React.ReactChild
}

const headerByDepth = [
    H1, H2, H3, H4, H5
] as const;

export const Header:
    (props: HeaderProps) => React.ReactElement
=
    ({ children, ...props}) => {
        const [title, ...others] = children instanceof Array?
            children: [children];
        const depth = React.useContext(sectionDepthContext);
        const Heading = headerByDepth[depth] ?? H5;


        return <L {...{
            [Wraps]: <header>
                <Heading>{title}</Heading>
                {others}
            </header>,
            ...props
        }}/>
    }
;

export interface NavProps extends PropsOf<'nav'>, LinearProps {

}

export const Nav:
    (props: NavProps) => React.ReactElement
=
    props => <L {...{
        [Wraps]: <nav/>,
        ...props
    }}/>
;
