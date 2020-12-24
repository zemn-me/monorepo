import React from 'react';
import style from './style.module.sass';
import * as unist from 'unist';
import path from 'path';
import glob from 'glob';
import parse from 'linear2/features/jmdx/parse';
import * as next from 'next';
import vfile from 'to-vfile';
import Render from 'linear2/features/md/render';
import exec from 'child_process';
import util from 'util';

class MultiError extends Error {
    errors: unknown[];
    constructor(errors: unknown[], message?: string) {
        super(`multiple errors in ${message}: ${errors.map(e => `${e}`).join(", ")}`);
        if (Error.captureStackTrace) Error.captureStackTrace(this, MultiError);
        this.errors = errors
        this.name = 'MultiError';
    }
}

async function attempt<I extends unknown[], O>(message: string, f: (...i: I) => O, ...p: I[]): Promise<O> {
    let errors: unknown[] = [];
    for (const params of p) {
        try {
            return await f(...params);
        } catch (e) { errors.push(e) }
    }

    throw new MultiError(errors, message);
}

async function extract(file: string) {
    const ast = await parse(await vfile.read(file));
    return { content: JSON.parse(JSON.stringify(ast)) }
}


function loadFile(target: string) {
    return attempt('loadFile', extract,
        [target + ".mdx"],
        [target + ".md"],
        [path.join(target, "index") + ".md"],
        [path.join(target, "index") +".mdx"]
    )
}

export async function Ast(...targetPath: string[]) {
    const target = path.join(process.cwd(), targetPath.join(path.sep));

    return await loadFile(target)
}

export async function In(...basePath: string[]) {
    return (await new Promise<string[]>( (ok, fail) =>
            glob(path.posix.join(process.cwd(), ...basePath, "**/*.@(mdx|md)"), (err, files) => {
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

export const pathsIn = async (...basePath: string[]) => {
    const r = {
        paths: (await In(...basePath))
            .map(({ web }) =>
                ({params: { path: web.split(path.posix.sep) } })),

        fallback: false
    };

    return r;
}

export const astAndPathsIn = async(...basePath: string[]) => {
    const articlePaths = await pathsIn(...basePath);
    return articlePaths.paths.map(path => {
        return { ...path, ast: Ast(...basePath, ...path.params.path) };
    });
}