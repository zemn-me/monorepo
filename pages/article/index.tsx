import React from 'react';
import fs from 'fs';
import * as mdx from 'linear2/features/mdx';
import glob from 'glob';
import path from 'path';
import Link from 'next/link';
import visit from 'unist-util-visit';
import util from 'util';
import parse from 'linear2/features/jmdx/parse';

const makeLinkLike = (s: string) => {
    const extname = path.extname(s);
    if (extname) s = s.slice(0, -extname.length);
    const basename = path.basename(s);
    if (basename == "index") s = s.slice(0, -"index".length);
    return s;
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

export async function getStaticProps() {
    return { props: {
        pages: JSON.parse(JSON.stringify(await Promise.all((await getRoutes())
            .map(async ({ local, ...etc }) => {
                const corpus = await util.promisify(fs.readFile)(local);
                const nodes = await parse(corpus);

                const titles = [];
                visit(nodes, node => node.type == 'heading' && node.depth == 1, node => titles.push(node));

                return { ...etc, title: titles[0] ?? "untitled" }
            }))))
    } }
}

type props = (ReturnType<typeof getStaticProps> extends Promise<infer Q>? Q: never)["props"];

export default function Dir(props: props) {
    return JSON.stringify(props);
}