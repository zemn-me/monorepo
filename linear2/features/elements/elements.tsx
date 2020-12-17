/* eslint-disable jsx-a11y/heading-has-content, jsx-a11y/anchor-has-content */

import React from 'react';
import * as fancy from './fancy';
import { Style, text } from './style';
import style from './base.module.sass';
import * as html from 'lib/unist-react/html/elements';
export { fancy };
export * from './text';
export * from './date';
export * from './headingsAndSections';
export * from './extraElements';
import * as elementUtil from 'linear2/features/elements/util';
export { default as style } from './base.module.sass';


const pick:
    <I extends object, K extends keyof I>(i: I, ...k: K[]) =>
        Pick<I, K>
=
    (i, ...k) => k.reduce((a, c) => (a[c] = i[c], a), {} as any);
;

type ValueOf<T> = T[keyof T]
type Filter<T, Q> = Pick<T,ValueOf<{ [K in keyof T]: T[K] extends Q? K: never }>>
type ClassableElements = Filter<JSX.IntrinsicElements, { className?: string  }>

const e:
    <E extends keyof ClassableElements, K extends keyof ClassableElements[E]>(name: E, ...propNames: K[])
        => React.FC<ClassableElements[E]>
=
    (e, ...k) => props => 
        <Style>{React.createElement(e, pick(props, ...k))}</Style>
;

type PropsOf<T extends React.FC<unknown>> = T extends React.FC<infer Q>?Q:never;

const s: <P>(i: React.FC<P>) => React.FC<P> = I => p => <Style><I {...p}/></Style>

export const frac: React.FC = ({ children }) => <span className={style.frac}>
    {children}
</span>

export const Ss02: React.FC = ({ children }) => <div className={style.ss02}>
    {children}
</div>;

export { Ss02 as ss02 };

export const fine: React.FC = () => <Ss02>fine</Ss02>;
export const ok: React.FC = () => <Ss02>ok</Ss02>;
export const paper: React.FC = () => <Ss02>paper</Ss02>;
export const scissors: React.FC = () => <Ss02>scissors</Ss02>;
export const stone: React.FC = () => <Ss02>stone</Ss02>

export const chem: React.FC<{ formula: string, name?: string }> = ({ formula, name }) => 
    name? <abbr className={style.chemical} title={name}><ChemStr>{formula}</ChemStr></abbr>:<ChemStr>{formula}</ChemStr>;

function* matchAll(s: string, re: RegExp) {
    for (;;) {
        const match = re.exec(s);
        if (match == null) return;
        yield match;
    }
}

const ChemStr: React.FC<{ children: string }> = ({ children }) => <>
    {[...matchAll((children as string), /[ABCDEFGHIJKLMNOPQRSTUVWXYZ]+|[^ABCDEFGHIJKLMNOPQRSTUVWZYZ]+/g)].map( ([c], i) =>
        !/[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/.test(c)?
        <span key={i} className={style.chem}>{c}</span>:
        <React.Fragment key={i}>{c}</React.Fragment>
    )}
</>;

export const p = s(html.p);
export const ul = s(html.ul);
export const section = s(html.section);
export const h1 = s(html.h1);
export const h2 = s(html.h2);
export const strong = s(html.strong);
export const h3 = s(html.h3);
export const li = s(html.li);
export const del = s(html.del);
export const a = s(html.a);
export const h4 = s(html.h4);
export const h5 = s(html.h5);
export const ol = s(html.ol);
export const em = s(html.em);
export const code = s(html.code);
export const aside = s(html.aside);
export const blockquote = s(html.blockquote);
export const sup = s(html.sup);
export const hr = s(html.hr);
export const dl = s(html.dl);
export const dt = s(html.dt);
export const img = s(html.img);
export const dd = s(html.dd);
export const input = s(html.input);
export const figure = s(html.figure);
export const figcaption = s(html.figcaption);
export { text };

