import React from 'react';
import * as unist from 'unist';
import path from 'path';
import glob from 'glob';
import parse from 'linear2/features/jmdx/parse';
import * as next from 'next';
import vfile from 'to-vfile';
import Render from 'linear2/features/md/render';

interface StaticPropsContext extends next.GetStaticPropsContext {
    params: {
        path: string[]
    }
}

export async function getStaticProps(context: StaticPropsContext) {
    const target = path.join(process.cwd(), "pages", "article", context?.params?.path?.join(path.sep));
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
            .map(p => ({ web: p.slice(0, -path.extname(p).length), local: p }))
            .map(({ web, ...etc }) => ({
                    ...etc,
                    web: path.relative(path.join(process.cwd(), "pages", "article"), web)
            }))
            .map(({ web, ...etc }) => ({
                ...etc,
                web: web.split(path.sep).join(path.posix.sep)
            }))
            .map(({ web, ...etc }) => {
                const basename = path.posix.basename(web);
                if (basename == "index") web = path.posix.join(web, "..")
                return { ...etc, web };
            })
}



export const getStaticPaths: next.GetStaticPaths = async () => {
    const r = {
        paths: (await getRoutes())
            .map(({ web }) =>
                ({params: { path: web.split(path.posix.sep) } })),

        fallback: false
    }
    console.log(JSON.stringify(r));

    return r;
}

export default function Jmdx(props: { content: unist.Node }) {
    return <Render node={props.content}/>
}