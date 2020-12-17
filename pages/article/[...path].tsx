import React from 'react';
import * as unist from 'unist';
import path from 'path';
import glob from 'glob';
import parse from 'linear2/features/jmdx/parse';
import * as next from 'next';
import vfile from 'to-vfile';
import Render from 'linear2/features/md/render';
import exec from 'child_process';
import util from 'util';

interface StaticPropsContext extends next.GetStaticPropsContext {
    params: {
        path: string[]
    }
}

async function attempt<I extends unknown[], O>(f: (...i: I) => O, ...p: I[]): O {
    let error: unknown;
    for (const params of p) {
        try {
            return await f(...params);
        } catch (e) { error = e }
    }

    throw error;
}

async function extract(file: string) {
    const ast = await parse(await vfile.read(file));
    return { content: JSON.parse(JSON.stringify(ast)) }
}


function loadFile(target: string) {
    return attempt(extract,
        [target + ".mdx"],
        [target + ".md"],
        [path.join(target, "index") + ".md"],
        [path.join(target, "index") +".mdx"]
    )
}

export async function getStaticProps(context: StaticPropsContext) {
    const target = path.join(process.cwd(), "pages", "article", context?.params?.path?.join(path.sep));

    return { props: await loadFile(target) }
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