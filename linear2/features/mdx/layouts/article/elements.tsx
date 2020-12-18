
import { extractText } from 'linear2/features/elements/extractText';
import Head from 'next/head';
import React from 'react';
import { toComponents } from '../../util';
import * as elements from 'linear2/features/elements';
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

;



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
} as const;

interface MDXElementProps {
    originalType: import('@mdx-js/react').ComponentType
    children?: MDXElementChildren
}

type MDXElementChildren = string | React.ReactElement<MDXElementProps>[]
    | React.ReactElement<MDXElementProps>



export { components as elements };
export default components;