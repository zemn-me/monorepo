import { useRouter } from 'next/router';
import Link from 'next/link';
import React from 'react';
import style from './pathnav.module.sass';
import { Div, Span } from '@zemn.me/linear';

export const PathNav:
    () => React.ReactElement
=
    () => {
        const router = useRouter();

        return <>
            <DisplayRoute {...{
                pathname: router.pathname.split("/"),
                asPath: router.asPath.split("/"),
                routes: process.env.routes as unknown as readonly string[]
            }}/>
        </>
    }
;

const DisplayRoute:
    (props: {
        pathname: readonly string[],
        asPath: readonly string[],
        depth?: number,
        routes: readonly string[]
    }) => React.ReactElement
=
    ({ pathname, asPath, depth = 0, routes }) => {
        let pathnametail = [...pathname];
        const ours = pathnametail.pop()!;

        let aspathtail = [...asPath];
        const oursaspath = aspathtail.pop()!;
        const isDynamicRoute = /^\[[^\]]*\]/.test(ours);
        const isHome = ours == "";

        const [ ourValue, setOurValue ] = React.useState(oursaspath);

        const validRoutes = routes.filter(route => route.startsWith(pathnametail.join("/")));

        console.log(process.env.routes);

        return <>
            {aspathtail.length?<><DisplayRoute {...{
                pathname: pathnametail,
                asPath: aspathtail,
                depth: depth+1,
                routes: validRoutes
            }}/> <Span className={style.arrow} aria-label="then">
                <Span aria-hidden="true">{">"}</Span>    
            </Span> </>: null} 

            {depth>0?
                <Link {...{
                    as: pathname.join("/"),
                    href: asPath.join("/")
                }}>
                    <a>{isHome?"🏠":ourValue}</a>
                </Link>: <>{isHome?"🏠":ourValue}</>
            }
        </>
    }
;