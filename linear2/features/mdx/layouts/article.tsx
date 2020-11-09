import { MDXProvider } from '@mdx-js/react';
import Head from 'next/head';
import React from 'react';
import { toComponents } from '../util';
import * as elements from 'linear2/features/elements';
import Base from 'linear2/features/layout/base';
import * as outline from 'linear2/features/elements/headingsAndSections/outlineState';
import { useRecoilState } from 'recoil';


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

    let codeProps: elements.CodeProps = { children: realProps.children };

    if (realProps?.className?.startsWith(languagePrefix)) {
        codeProps.language = realProps.className.slice(languagePrefix.length);
    }

    return <elements.CodeBlock {...codeProps} />
}

const components = {
    ...toComponents(elements),
    pre: Pre
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

const TitleSetter: () => React.ReactElement =  () => {
    const [ index ] = useRecoilState(outline.state);
    const titleElement = [...index.children]?.[0]?.element;
    const [ setText, text ] = elements.useText();

    return <>
        <div ref={setText}>{titleElement??null}</div>
        <Head>
            <title>{text?.trim()??"Untitled"}</title>
        </Head>
    </>
}

export const Article:
    (frontmatter: any) => React.FC
=
    () => ({ children }) => <article style={{ maxWidth: "35rem", margin: "auto" }}><Base>
            <MDXProvider components={components}>
                <TitleSetter/>
                <IndexRoot/>
            {children}
        </MDXProvider>
    </Base></article>
;

export default Article;