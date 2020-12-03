import parse from 'linear2/features/jmdx/parse'
import React from 'react';
import vfile from 'to-vfile';
import path from 'path';
import inspect from 'unist-util-inspect';
import * as jmdx from 'linear2/features/jmdx';
import * as elements from 'linear2/features/elements';


export async function getStaticProps() {
    const content = 
            await vfile.read(path.join(process.cwd(), "pages", "article", "2020", "icloud", "index.mdx"))

    return { props: { content: JSON.parse(JSON.stringify(await parse(content)))} }
}

const Renderer:
    (props: jmdx.Node) => React.ReactElement
=
    ({ ...props }) => {
        let position;
        ({ position, ...props } = props);
        if (props == undefined) return "(undefined)";
        const { children, type } = props;
        switch (type) {
        case 'root': return children;
        case 'thematicBreak': return <jmdx.mdast.ThematicBreak {...props}/>
        case 'paragraph': return <jmdx.mdast.Paragraph {...props}/>
        case 'meta': return <meta {...props}/>
        case 'text': return <jmdx.mdast.Text {...props}/>
        case 'list': return <jmdx.mdast.List {...props}/>
        case 'listItem': return <jmdx.mdast.ListItem {...props}/>
        case 'section': return <section {...props}/>
        case 'heading': return <elements.Heading {...props}/>
        case 'date': return "<Date/>";
        case 'inlineCode': return <jmdx.mdast.InlineCode {...props}/>
        case 'code': return <jmdx.mdast.Code {...props}/>
        case 'definition': return null;
        case 'comment': return null;
        case 'ul': case 'ol': case 'li': case 'img': case 'code': case 'em':
        case 'a': case 'dl': case 'dt': case 'dd': case 'blockquote':
        case 'strong':
            return React.createElement(type, props);
        case 'footnotes':
            return <footer>{children}</footer>
        default:
            console.error("missing definition for", type);
            return `<${type}/>`
        }
    }
;

export default function Jmdx(props) {
    return <jmdx.Render
        node={props.content}
        render={<jmdx.mdast.RenderHtml render={<Renderer/>}/>}/>
    //return <>{inspect(props)}</>
    /*return <RenderDebug fragment={props.content}
        elements={{
            elements: elements,
            //unknown: () => "unknown"
        }}/>*/
}