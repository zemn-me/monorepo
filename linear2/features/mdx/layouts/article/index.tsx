import { MDXProvider } from '@mdx-js/react';
import { extractText } from 'linear2/features/elements/extractText';
import Head from 'next/head';
import React from 'react';
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
    <small>
        {children}
    </small>
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

const components = {
    ...toComponents(elements),
    a: A,
    Footnotes,
    section: elements.fancy.Section,
    li: Li,
    ol: elements.fancy.Ol,
    ul: elements.fancy.Ul,
    h1, h2, h3, h4, h5,
    CodeBlock,
    head: Head
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

        const titleEl = findH1(children)
        const title = titleEl ? extractText(titleEl) : "Untitled";

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
            <main className={`${elements.style.root}`}>
                <MDXProvider components={{...components as any, Date}}>
                    <article style={{ maxWidth: "35rem", margin: "auto" }}
                        className={elements.style.linear}>
                        <Head>
                            <title>{title}</title>
                        </Head>
                        <IndexRoot />
                        {children}
                        
                        {
                            frontmatter.tags
                            ? frontmatter.tags.map((tag: any, i: number) =>
                                <a className={style.tag} href={`../tag/${tag}`} key={i}>{tag}</a>
                            ): null
                        }

                        <p> some footer here probably</p>
                    </article>
                </MDXProvider>
            </main>

        </Base>
    }
    ;

export default Article;