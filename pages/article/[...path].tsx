import React from 'react';
import path from 'path';
import inspect from 'unist-util-inspect';
import * as jmdx from 'linear2/features/jmdx';
import * as elements from 'linear2/features/elements';
import glob from 'glob';
import fs from 'fs';
import util from 'util';
import vfile from 'to-vfile';
import parse from 'linear2/features/jmdx/parse';


export async function getStaticProps(context) {
    const target = path.join(process.cwd(), "pages", "article", context.params.path.join(path.sep));
    let content;
    try {
        content = await vfile.read(target+".mdx")
    } catch {
        content = await vfile.read(path.join(target, "index") + ".mdx")
    }

    return { props: { content: JSON.parse(JSON.stringify(await parse(content)))} }
}

export async function getRoutes() {
    return (await new Promise<string[]>( (ok, fail) =>
            glob(path.join(process.cwd(), "pages", "article", "**/*.mdx"), (err, files) => {
                if (err) return fail(err);
                return ok(files);
            })))
            .map(p => p.slice(0, -path.extname(p).length))
            .map(p => path.relative(path.join(process.cwd(), "pages", "article"), p))
            .map(p => p.split(path.sep).join(path.posix.sep))
            .map(p => {
                const basename = path.posix.basename(p);
                if (basename == "index") p = path.posix.join(p, "..")
                return p;
            })
            .map(p => ({ params: { path: p.split(path.posix.sep) } }))
}

export async function getStaticPaths(context) {
    const r = {
        paths: await getRoutes(),

        fallback: false
    }
    console.log(JSON.stringify(r));

    return r;

}

const Renderer:
    (props: jmdx.Node) => React.ReactElement
=
    ({ ...props }) => {
        let position;
        let idx, data, type;
        ({ position, idx, data, type, ...props } = props);
        const { children } = props;
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