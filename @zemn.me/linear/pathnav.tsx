import { useRouter } from 'next/router';
import Link from 'next/link';
import React from 'react';
import style from './pathnav.module.sass';
import { Div, Span, A } from '@zemn.me/linear';
import { routes, routeTrie, Trie } from '@zemn.me/linear/env';
import next from 'next';
import { timingSafeEqual } from 'crypto';

export const PathNav:
    () => React.ReactElement
=
    () => {
        const router = useRouter();

        return <>
            <DisplayRoute {...{
                pathname: router.pathname.split("/"),
                asPath: router.asPath.split("/"),
                routes: routes.map(route =>  route.split("/"))
            }}/>
        </>
    }
;

const DisplayRoute:
    (props: {
        pathname: readonly string[],
        asPath: readonly string[],
        depth?: number
    }) => React.ReactElement
=
    ({ pathname, asPath, depth = 0 }) => {

        const path = {
            name: {
                head: pathname.slice(0, depth),
                part: pathname[depth]
            },

            asPath: {
                tail: asPath.slice(depth),
                part: asPath[depth]
            }
        } as const

        const displayName = path.asPath.part == ""? "home": path.asPath.part;


        const a = <a>{displayName}</a>;

        return <>
            {path.name.head.length>0
                ? <Link href={pathname.slice(0, -depth+1).join("/")}
                    as={asPath.slice(0, -depth+1).join("/")}>{a}</Link>
                : a
            }
            {depth < pathname.length-1? <>
                {">"}
                <DisplayRoute {...{
                    pathname, asPath, depth: depth+1, 
                }}/>
            </>: null}
        </>
    }
;