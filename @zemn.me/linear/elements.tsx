/* eslint-disable jsx-a11y/heading-has-content, jsx-a11y/anchor-has-content */

import React from 'react';
import style from './style';
import classes from './classes';
import * as classProvider from './classprovider';
import * as env from './env';
import * as indexer from './indexer';
import * as i8n from '@zemn.me/linear/i8n';
import CodeHelper from '@zemn.me/linear/codehelper'

export type Child = React.ReactElement | i8n.Text;
export type Node = Child | React.ReactFragment | React.ReactPortal | null | undefined

type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

interface DarkMode {
    dark?: boolean;
}

const linearClassContext = classProvider.New(style.linear);

const specialClasses: Readonly<Record<string,string>> = {
    "footnote-ref": style.footnoteRef,
    "footnote-backref": style.footnoteBackref
};

/**
 * These are special props which propagate to children via context.
 */
interface LinearGlobals extends DarkMode { }

type LinearProps<T extends { className?: string }> = (
    T extends { children: any }
        ? Omit<T, 'children'> & { children?: Node | Node[] }
        : T
    ) & LinearGlobals;

type exampleProps = LinearProps<{
    size: number,
    className?: string
}>

const Wraps = '__wraps_component_' as const;


export interface LinearifyProps<P extends { className?: string }> {
    children: React.ReactElement<LinearProps<P>>
}

const Linearify:
    <P extends { className?: string }>(props: LinearifyProps<P>) => React.ReactElement
=
    ({ children }) => {
        const [ classes1, wrap1 ] = classProvider.useClass({
            context: linearClassContext  
        });

        const cls = classes(children.props.className, ...classes1);

        if ("className" in cls) cls.className =
            cls.className.split(" ").map(c => c in specialClasses?
                    specialClasses[c]: c).join(" ");


        return wrap1(
            React.cloneElement(children, {
                ...cls
            } as any)
        )

    }
;

type ElProps<s extends keyof JSX.IntrinsicElements, props = PropsOf<s>> = LinearProps<props>

const L = Linearify;

export interface DivProps extends ElProps<'div'> { }

export const Div:
    (props: DivProps) => React.ReactElement
    =
    props => <L><div {...props}/></L>


export interface PProps extends ElProps<'p'> { }

export const P:
    (props: PProps) => React.ReactElement
    =

    props =><L><p {...props}/></L>

export interface InputProps extends ElProps<'input'> { }

export const Input:
    (props: InputProps) => React.ReactElement
    = props => <L><input {...props}/></L>

export interface H1Props extends ElProps<'h1'> { }


/**
 * `H1_` is the true H1 element. You likely want to use
 * `H1`, which is the same but is an h1 *relative* to the
 * current context; that is: `<Section><Section><H1>Hi!</H1></Section></Section>`
 * is actually an H2.
 */
export const H1_:
    (props: H1Props) => React.ReactElement
    =
    props => <L><h1 {...props}/></L>


type p = { [k in keyof HeaderProps]: HeaderProps[k] }

export const H1:
    (props: H1Props) => React.ReactElement
=
    ({  ...props }) => <Heading depth={1} {...props}/>
;

export interface H2Props extends ElProps<'h2'> { }

export const H2_:
    (props: H2Props) => React.ReactElement
    =
    props => <L><h2 {...props}/></L>
    ;



export const H2:
    (props: H2Props) => React.ReactElement
=
    props => <Heading depth={2} {...props}/>
;

export interface H3Props extends ElProps<'h3'> { }

export const H3_:
    (props: H3Props) => React.ReactElement
    =
    props => <L><h3 {...props}/></L>
;



export const H3:
    (props: H3Props) => React.ReactElement
=
    props => <Heading depth={3} {...props}/>
;

export interface H4Props extends ElProps<'h4'> { }

export const H4_:
    (props: H4Props) => React.ReactElement
    =
    props => <L><h4 {...props}/></L>

;

export const H4:
    (props: H4Props) => React.ReactElement
=
    props => <Heading depth={4} {...props}/>
;

export interface H5Props extends ElProps<'h5'> { }

export const H5_:
    (props: H5Props) => React.ReactElement
    =
    props => <L><h5 {...props}/></L>
    ;

export const H5:
    (props: H5Props) => React.ReactElement
=
    props => <Heading depth={5} {...props}/>
;


export interface StrongProps extends ElProps<'strong'> { }

export const Strong:
    (props: StrongProps) => React.ReactElement
    =
    props => <L><strong {...props}/></L>

export interface EmProps extends ElProps<'em'> { }

export const Em:
    (props: EmProps) => React.ReactElement
    =
    props => <L><em {...props}/></L>
    ;

export interface SpanProps extends ElProps<'span'> { }

export const Span:
    (props: SpanProps) => React.ReactElement
    =
    props => <L><span {...props}/></L>

    ;

export interface HrProps extends ElProps<'hr', Omit<PropsOf<'hr'>, 'children'>> { }

export const Hr:
    (props: HrProps) => React.ReactElement
    =
    props => <L><hr {...props}/></L>
    ;

export interface MainProps extends ElProps<'main'> { }

export const Main:
    (props: MainProps) => React.ReactElement
    =
    ({ ...props }) => <L><main {...props}/></L>
    ;

export interface AProps extends ElProps<'a', Omit<PropsOf<'a'>, 'href'>> {
    href?: URL
}

const trimLink:
    (link: string, origin?: string, protocol?: string) => string
    =
    (
        link,
        origin = env.origin,
        protocol = env.protocol) => {

        if (link.startsWith(origin))
            return link.slice(origin.length);

        if (link.startsWith("about:blank"))
            return link.slice("about:blank".length)

        if (link.startsWith(protocol))
            return link.slice(protocol.length);

        return link;
    }

    ;

export const A:
    (props: AProps) => React.ReactElement
    =
    ({ href, ...props }) => {
    
        return <L>
             <a {...{
                href: href? trimLink(href.toString()): href,
                ...props
            }}/>
        </L>
    }
 

export interface TimeProps extends ElProps<'time', Omit<PropsOf<'time'>, 'dateTime'>> {
    dateTime?: Date
}

export const Time:
    (props: TimeProps) => React.ReactElement
    =
    ({ dateTime, ...props }) => <L>
            <time {...{
                dateTime: dateTime?.toString(),
                ...props
            }} />
        </L>

    ;

export interface LiProps extends ElProps<'li'> {}

export const Li:
    (props: LiProps) => React.ReactElement
=
    props => <L><li {...props}/></L>
;

export interface UlProps extends ElProps<'ul'> {}

export const Ul:
    (props: UlProps) => React.ReactElement
=
    props => <L><ul {...props}/></L>
;

export interface OlProps extends ElProps<'ol'>{}

export const Ol:
    (props: OlProps) => React.ReactElement
=
    props => <L><ol {...props}/></L>
;


export interface ArticleProps extends ElProps<'article'> {}

export const Article =
    React.forwardRef<HTMLElement,  ArticleProps>(({ ...props }, ref) =>
            <L><article ref={ref} {...props}/></L>
    )
;

Article.displayName = Object.keys({Article})[0]

export interface ProseProps extends ArticleProps { }

export const Prose =
    React.forwardRef<HTMLElement, ProseProps>(({ ...props }, ref) =>
            <Article className={style.prose} {...props} ref={ref}/>
    )
;

export interface PreProps extends ElProps<'pre'> {}

export const Pre:
    (props: PreProps) => React.ReactElement
=
    props => {

        /**
         * fix an annoying thing where mdx makes code blocks into
         * `<pre><code/></pre>` instead of the more sensible
         * <code><pre/></code>
         */
        if (React.Children.count(props.children) == 1) {
            const childProps = (React.Children.only(props.children) as any).props as {
                mdxType?: string   
            };

            if (childProps.mdxType == "code") {
                return <>{React.Children.only(props.children)}</>
            }
        }
    
        return <L><pre {...props}/></L>
    }

export interface IndexProps {
    children: React.FC<{
        index?: indexer.Index
    }>
}

export const sectionDepthContext = React.createContext<number>(0);

export interface SectionProps extends ElProps<'section'> {}

export const Section:
    (props: SectionProps) => React.ReactElement
=
    ({ ...props }) => {
        const depth = React.useContext(sectionDepthContext);

        return <sectionDepthContext.Provider value={depth+1}>
            <L><section {...props}/></L>
        </sectionDepthContext.Provider>
    }
;

export interface HeadingProps extends ElProps<'h1'> {
    depth?: 0 | 1 | 2 | 3 | 4 | 5
}

const headerByDepth = [
    H1_, H2_, H3_, H4_, H5_
] as const;

export const Heading:
    (props: HeadingProps) => React.ReactElement
=
    ({ children, depth: depthOffset = 1, ...props}) => {
        const depth = React.useContext(sectionDepthContext) + depthOffset;
        const H = headerByDepth[depth -1] ?? H5;

        return <L><H {...props}>{children}</H></L>
    }
;

export interface HeaderProps extends ElProps<'header'> { }

export const Header:
    (props: HeadingProps) => React.ReactElement
=
    props => <L><header {...props}/></L>
;

export interface NavProps extends ElProps<'nav'> { }

export const Nav:
    (props: NavProps) => React.ReactElement
=
    props => <L><nav {...props}/></L>

export interface FracProps extends ElProps<'span'> { }

export const Frac:
    (props: FracProps) => React.ReactElement
=
    ({ className, ...props }) => <L>
        <Span {...{
            ...classes(style.frac, className),
            ...props
        }}/>
    </L>
;

export interface MathSymbolProps extends ElProps<'span'> {}

export const MathSymbol:
    (props: MathSymbolProps) => React.ReactElement
=
    ({ className, ...props }) => <L>
        <Span {...{
            ...classes(style.math, className),
            ...props
        }}/>
    </L>
;

export interface OrdProps extends ElProps<'span'> {}

export const Ord:
    (props: OrdProps) => React.ReactElement
=
    ({ className, ...props }) => <L>
        <Span {...{
            ...classes(style.ord, className),
            ...props
        }}/>
    </L>
;


export interface SupProps extends ElProps<'sup'> { }

export const Sup:
    (props: SupProps) => React.ReactElement
=
    props => <L><sup {...props}/></L>
;

export interface ProseImgProps extends ElProps<'img'> {}

export const ProseImg:
    (props: ProseImgProps) => React.ReactElement
=
    ({ alt, src, ...props }) => {
        if (!alt) return <L><img {...props}/></L>
        return <L><figure {...props}>
            <img {...{ alt, src}}/>
        <figcaption>{alt}</figcaption>
        </figure></L>
    }
;

export interface CodeProps extends ElProps<'code'> {
    CodeCommentHelper?: string
}

export const Code:
    (props: CodeProps) => React.ReactElement
=
    ({ CodeCommentHelper, children, ...props }) => {

        if (CodeCommentHelper) return <L><CodeHelper {...{
            prefix: CodeCommentHelper,
            ...props  
        }}>{children as string}</CodeHelper></L>

        return <L><code {...props}>{children}</code></L>
    }
;