import { MDXProvider } from '@mdx-js/react';
import React from 'react';
import { toComponents } from '../util';
import * as elements from 'linear2/features/elements';


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


export const Article:
    (frontmatter: any) => React.FC
=
    () => ({ children }) => <MDXProvider components={components}>
        {children}
    </MDXProvider>
;

export default Article;