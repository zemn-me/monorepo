/* eslint-disable jsx-a11y/heading-has-content, jsx-a11y/anchor-has-content */

import React from 'react';
import style from './style';
import classes from './classes';
import * as classProvider from './classprovider';

type PropsOf<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T];

interface DarkMode {
    dark?: boolean;
}

const linearClassContext = classProvider.New(style.linear);
const darkModeClassContext = classProvider.New(style.darkmode);

/**
 * These are special props which propagate to children via context.
 */
interface LinearGlobals extends DarkMode { }

/**
 * These props are added to all linear elements
 */
interface LinearProps extends LinearGlobals { }

const LinearContext = React.createContext<LinearProps | undefined>(void 0);

const linearPropkeys = ['dark'] as (keyof LinearProps)[];
const globalPropKeys = linearPropkeys;

const useDarkMode:
    (props: DarkMode) => string | undefined
    =
    ({ dark }) => dark ? style.darkmode : undefined
    ;

const Pick:
    <T, V extends keyof T>(v: T, ...keys: V[]) => Pick<T, V>
    =
    (v, ...keys) => PickOmit(v, ...keys)[0];
;

const Omit:
    <T, V extends keyof T>(v: T, ...keys: V[]) => Omit<T, V>
    =
    (v, ...keys) => PickOmit(v, ...keys)[1];



const PickOmit:

    <T, V extends keyof T>(v: T, ...keys: V[]) => [Pick<T, V>, Omit<T, V>]

    =

    (v, ...keys) => {
        let pick = {} as any;
        let omit = { ...v } as any;
        for (const key of keys) {
            delete omit[key];
            pick[key] = v[key]
        }
        return [pick, omit];
    }

    ;


const objectIsEmpty =
    (v: object): v is {} => !Object.entries(v).some(([, v]) => v !== undefined);

interface LinearifyChildProps extends LinearProps {
    children?: React.ReactNode
    className?: string
}

const Wraps = Symbol();

export type LinearifyProps<P extends { className?: string }> =
    { [Wraps]: React.ReactElement<P> } & P & LinearProps

const Linearify:
    <P extends { className?: string }>(props: LinearifyProps<P>) => React.ReactElement
=
    ({ [Wraps]: children, dark, ...extraProps }) => {
        if (!children) throw new Error("missing children");

        let rsp: React.ReactElement;

        let withLinearClass = <classProvider.UseClass {...{
            ctx: linearClassContext,
            ...extraProps as any
        }}>
            {children}
        </classProvider.UseClass>;

        rsp = withLinearClass;

        if (dark) rsp = <classProvider.UseClass {...{
            ctx: darkModeClassContext,
        }}>
            {withLinearClass}
        </classProvider.UseClass>;

        return rsp;
    }
;

const L = Linearify;

export interface DivProps extends PropsOf<'div'>, LinearProps { }

export const Div:
    (props: DivProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <div/>,
        ...props
    }}/>


export interface PProps extends PropsOf<'p'>, LinearProps { }

export const P:
    (props: PProps) => React.ReactElement
    =

    props => <L {...{
        [Wraps]: <p/>,
        ...props
    }}/>

export interface InputProps extends PropsOf<'input'>, LinearProps { }

export const Input:
    (props: InputProps) => React.ReactElement
    = props => <L {...{
        [Wraps]: <input/>,
        ...props
    }}/>

export interface H1Props extends PropsOf<'h1'>, LinearProps { }

export const H1:
    (props: H1Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <H1/>,
        ...props
    }}/>

export interface H2Props extends PropsOf<'h2'>, LinearProps { }

export const H2:
    (props: H2Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <H2/>,
        ...props
    }}/>
    ;


export interface H3Props extends PropsOf<'h3'>, LinearProps { }

export const H3:
    (props: H3Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <H3/>,
        ...props
    }}/>

export interface H4Props extends PropsOf<'h4'>, LinearProps { }

export const H4:
    (props: H4Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <H4/>,
        ...props
    }}/>

export interface H5Props extends PropsOf<'h5'>, LinearProps { }

export const H5:
    (props: H5Props) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <H5/>,
        ...props
    }}/>
    ;

export interface StrongProps extends PropsOf<'strong'>, LinearProps { }

export const Strong:
    (props: StrongProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <Strong/>,
        ...props
    }}/>

export interface EmProps extends PropsOf<'em'>, LinearProps { }

export const Em:
    (props: EmProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <em/>,
        ...props
    }}/>
    ;

export interface SpanProps extends PropsOf<'span'>, LinearProps { }

export const Span:
    (props: SpanProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <span/>,
        ...props
    }}/>

    ;

export interface HrProps extends Omit<PropsOf<'hr'>, 'children'>, LinearProps { }

export const Hr:
    (props: HrProps) => React.ReactElement
    =
    props => <L {...{
        [Wraps]: <hr/>,
        ...props
    }}/>
    ;

export interface MainProps extends PropsOf<'main'>, LinearProps { }

export const Main:
    (props: MainProps) => React.ReactElement
    =
    ({ className, ...props }) => <L {...{
        [Wraps]: <main/>,
        ...props
    }}/>
    ;

export interface AProps extends PropsOf<'a'>, LinearProps { }

const trimLink:
    (link: string) => string
    =
    link => {
        if (link.startsWith(window.location.origin))
            return link.slice(window.location.origin.length);

        if (link.startsWith(window.location.protocol))
            return link.slice(window.location.protocol.length);

        return link;
    }

    ;

export const A:
    (props: AProps) => React.ReactElement
    =
    ({ href, ...props }) => <L {...{
        [Wraps]: <a {...{
            href: href? trimLink(href): href,
        }}/>,
        ...props
    }}/>
 

export interface TimeProps extends Omit<PropsOf<'time'>, 'dateTime'>, LinearProps {
    dateTime?: Date | PropsOf<'time'>["dateTime"]
}

export const Time:
    (props: TimeProps) => React.ReactElement
    =
    ({ dateTime, ...props }) => <L {...{
        [Wraps]: <time {...{
                dateTime: dateTime instanceof Date ?
                    dateTime.toDateString() : dateTime
            }} />,
            dark: true,
            ...props
    }}/>

    ;


