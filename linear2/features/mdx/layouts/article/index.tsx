import { MDXProvider } from '@mdx-js/react';
import * as mdx from 'linear2/features/mdx';
import { Runs } from './runs';
import { extractText } from 'linear2/features/elements/extractText';
import Head from 'next/head';
import React, { JSXElementConstructor } from 'react';
import { toComponents } from '../../util';
import * as elements from 'linear2/features/elements';
import * as model from 'linear2/model';
import Base from 'linear2/features/layout/base';
import * as outline from 'linear2/features/elements/headingsAndSections/outlineState';
import { useRecoilState } from 'recoil';
import style from './article.module.sass';
import { PropsOf } from 'linear2/features/elements/util';

type aprops = JSX.IntrinsicElements["a"]
interface AProps extends aprops { }

const FootnoteBackref = ({ children, ...props} : AProps) => 
        <a {...{
            ...props,
            className: style.footnoteBackref,
        }}>
            <span role="img" aria-label="go back">{children}</span>
        </a>

const Footnoteref = (props: AProps) => <a {...{
    ...props,
    className: style.footnoteRef
}}/>

const A: (props: AProps) => React.ReactElement = props => {
    switch (props.className) {
    case "footnote-backref": return <FootnoteBackref {...props}/>
    case "footnote-ref": return <Footnoteref {...props}/>
    }

    return <a {...props}/>
}

const Footnotes: React.FC = ({ children }) => <aside className={style.Footnotes}>
    {children}
</aside>

const Li = React.forwardRef<HTMLLIElement, Omit<PropsOf<'li'>, 'ref'>>(
    ({ children, ...props }, ref) => {
        /**
         * mdx has a thing where it makes <p>
         * tags when there is a space after an element
         * in a list.
         * 
         * I hate that.
         */
        if (React.Children.count(children) == 1) {
            if ((children as any)?.props?.originalType == 'p')
            children = (children as any).props.children
        }

        if (React.Children.count(children) == 2) {
            const [ a, b ] = React.Children.toArray(children);
            if ((a as any)?.props?.originalType == 'p' && (
                (b as any)?.props?.originalType == 'ol' ||
                (b as any)?.props?.originalType == 'ul'
            )) children = React.Children.map(children, (c, i) => {
                if (i == 0) return (c as any).props.children;
                return c;
            })
        }

        return <elements.fancy.Li {...{children, ...props }}/>
    }
);

let h1, h2, h3, h4, h5;

// headings are given contextual depth
h1 = h2 = h3 = h4 = h5 = elements.Heading;

const languagePrefix = "language-" as const;
const CodeBlock: React.FC<elements.CodeProps & PropsOf<'code'>> = ({ className, ...props }) => {
    if (className?.startsWith(languagePrefix)) {
        props.language = className.slice(languagePrefix.length);
    }

    return <elements.CodeBlock {...props} />
}

const Description: React.FC<{ children: React.ReactElement }> =
    ({ children }) => {
        const text = extractText(children);

        return <>
            <Head>
                <meta name="description" content={text}/>
                <meta property="og:description" content={text}/>
            </Head>

            <p><i>{text}</i></p>
        </>
    }

const frac: React.FC = ({ children }) => <div className={style.frac}>{children}</div>;

const Ss02: React.FC = ({ children }) => <div className={style.ss02}>
    {children}
</div>;

const Fine: React.FC = () => <Ss02>fine</Ss02>;
const Ok: React.FC = () => <Ss02>ok</Ss02>;
const Paper: React.FC = () => <Ss02>paper</Ss02>;
const Scissors: React.FC = () => <Ss02>scissors</Ss02>;
const Stone: React.FC = () => <Ss02>stone</Ss02>;

function* matchAll(s: string, re: RegExp) {
    for (;;) {
        const match = re.exec(s);
        if (match == null) return;
        yield match;
    }
}

const Chem: React.FC<{ children: string, name?: string }> = ({ children, name }) => 
    name? <abbr className={style.chemical} title={name}><ChemStr>{children}</ChemStr></abbr>:<ChemStr>{children}</ChemStr>;

const ChemStr: React.FC<{ children: string }> = ({ children }) => <>
    {[...matchAll((children as string), /[ABCDEFGHIJKLMNOPQRSTUVWXYZ]+|[^ABCDEFGHIJKLMNOPQRSTUVWZYZ]+/g)].map( ([c], i) =>
        !/[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/.test(c)?
        <span key={i} className={style.chem}>{c}</span>:
        <React.Fragment key={i}>{c}</React.Fragment>
    )}
</>;

const Section = (a: elements.fancy.SectionProps) => <elements.fancy.Section {...a}
        sectionChildWrapperClass={style.sectionChildren}
/>;

const components = {
    ...toComponents(elements),
    section: Section,
    a: A,
    Footnotes,
    li: Li,
    ol: elements.fancy.Ol,
    ul: elements.fancy.Ul,
    h1, h2, h3, h4, h5,
    CodeBlock,
    head: Head,
    Description,
    frac,
    Fine, Ok, Paper, Scissors, Stone, Chem,
    chem: Chem,
}

const IndexRoot: () => React.ReactElement = () => {
    const [ index ] = useRecoilState(outline.state);
    return <nav><Index node={index}/></nav>
}

const Index: React.FC<{ node: outline.Root | outline.Node  }>  = ({ node }) => {
    if (!node) return null;

    return <ol>
        {node?.element?.props.children ?? null}
        <ol>
            {[...node.children].map((v, i) => <li key={i}><Index node={v}/></li>)}
        </ol>
    </ol>
}

interface MDXElementProps {
    originalType: import('@mdx-js/react').ComponentType
    children?: MDXElementChildren
}

type MDXElementChildren = string | React.ReactElement<MDXElementProps>[]
    | React.ReactElement<MDXElementProps>


/**
 * Returns the first H1 element in an MDX tree, breadth first
 */
const findH1:
    (e: MDXElementChildren) => React.ReactElement<MDXElementProps> | undefined
    =
    c => {
        if (c instanceof Array) for (let child of c) {
            const r = findH1(child);
            if (r !== undefined) return r;
        }

        if (typeof c == "string") return undefined;
        if ("props" in c) {
            if (c.props.originalType == "h1") return c;
            if (c.props.children) return findH1(c.props.children)
        }
        return undefined;
    }
    ;

export const Article:
    (frontmatter: any) => React.FC<{
        children: React.ReactElement<MDXElementProps>[]
    }>
    =
    frontmatter => ({ children }) => {

        const title = mdx.util.getTitle(children as any);

        /*console.log(...
            model.iter.filter(
                mdx.util.getMdxElement(children as any),
                (v: mdx.util.MDXCreateElement) =>
                   ["h1", "h2", "h3", "h4", "h5"].some(t => v.props.mdxType == t)
            )
        );*/

        let Date;

        if (frontmatter.date) {
            const date = model.time.date.parse(frontmatter.date)
            Date = () => <elements.Date
                date={date}
                weekday="long"
                year="numeric"
                month="long"
                day="numeric"
            />
        }

        return <Base>
            {console.log(style)}
            <MDXProvider components={{...components as any, Date}}>
                <article {...{
                    ...elements.util.classes(
                        elements.style.linear,
                        style.article
                    )
                }}>
                    <Head>
                        <title>{title}</title>
                        <meta property="og:type" content="article"/>
                        <meta name="title" content={title}/>
                        <meta property="og:title" content={title}/>
                        <meta name="twitter:site" content="@zemnmez"/>
                        <meta name="twitter:title" content={title}/>
                    </Head>
                    <IndexRoot />
                    {children}
                    {
                        frontmatter.tags
                        ? frontmatter.tags.map((tag: any, i: number) =>
                            <a className={style.tag} href={`../tag/${tag}`} key={i}>{tag}</a>
                        ): null
                    }

                </article>
            </MDXProvider>
        </Base>
    }
    ;

export default Article;