import { MDXProvider } from '@mdx-js/react';
import { extractText } from 'linear2/features/elements/extractText';
import Head from 'next/head';
import React from 'react';
import { toComponents } from '../util';
import * as elements from 'linear2/features/elements';
import Base from 'linear2/features/layout/base';
import * as outline from 'linear2/features/elements/headingsAndSections/outlineState';
import { useRecoilState } from 'recoil';
import style from './article.module.sass';
import * as fancyElements from 'linear2/features/elements/headingsAndSections/fancy';

const languagePrefix = "language-" as const;

const Pre: React.FC = props => {
    const { children } = props;
    if (React.Children.count(children) > 1) return <pre {...props}/>
    const child = React.Children.only(children);
    if (!child) return <pre {...props}/>;
    if (!(child instanceof Object)) return <pre {...props}/>;
    if (!("props" in child)) return <pre {...props}/>;
    const p = child.props;
    if (!("originalType" in p)) return <pre {...props}/>;
    const realProps = p as {
        parentName?: string,
        className?: string,
        children: React.ReactElement
        originalType?: string
    };

    if (realProps.originalType !== "code") return <pre {...props}/>;
    if (typeof realProps.children !== "string") return <pre {...props} />

    let codeProps: elements.CodeProps = { ...props, ...realProps, children: realProps.children,  };

    if (realProps?.className?.startsWith(languagePrefix)) {
        codeProps.language = realProps.className.slice(languagePrefix.length);
    }

    return <elements.CodeBlock {...codeProps} />
}

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

let h1, h2, h3, h4, h5;

// headings are given contextual depth
h1 = h2 = h3 = h4 = h5 = elements.Heading;

const components = {
    ...toComponents(elements),
    pre: Pre,
    a: A,
    Footnotes,
    section: fancyElements.Section,
    h1, h2, h3, h4, h5
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
    () => ({ children }) => {

        const titleEl = findH1(children)
        const title = titleEl ? extractText(titleEl) : "Untitled";

        return <Base>
            <main className={elements.style.root}>
                <MDXProvider components={components as any}>
                    <article style={{ maxWidth: "35rem", margin: "auto" }}
                        className={elements.style.linear}>
                        <Head>
                            <title>{title}</title>
                        </Head>
                        <IndexRoot />
                        {children}
                    </article>
                </MDXProvider>
            </main>

        </Base>
    }
    ;

export default Article;