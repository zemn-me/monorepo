import React from 'react';
import * as mdx from 'linear2/features/mdx';
import glob from 'glob';
import path from 'path';
import Link from 'next/link';

const makeLinkLike = (s: string) => {
    const extname = path.extname(s);
    if (extname) s = s.slice(0, -extname.length);
    const basename = path.basename(s);
    if (basename == "index") s = s.slice(0, -"index".length);
    return s;
}

export async function getStaticProps() {
    const pagesPath = path.posix.join(process.cwd(), "pages");
    const articlePath = path.posix.join(pagesPath, "article");
    const matches = glob.sync(path.posix.join(articlePath, "**", "*.mdx"));

    const articles = matches.map(p => {
        return { linkPath: makeLinkLike(path.posix.relative(pagesPath, p)) }
    }).filter((v) => v !== undefined);

    return { props: { pages: articles } }
}

type props = (ReturnType<typeof getStaticProps> extends Promise<infer Q>? Q: never)["props"];

export default function Dir(props: props) {
    return props.pages.map((d, i) => <Link key={i} href={d.linkPath}>
        <a>{d.linkPath}</a>
    </Link>);
}