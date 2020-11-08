/**
 * @fileinfo headings have a slightly different story from normal.
 * The problem with 'normal' headings is that they are not relative to their nested context
 * for example, let's say I write some text:
 * ```
 * <h1>welcome to my section!</h1>
 * <p>some text!<p>
 * ```
 * 
 * Now, if I embed this in *another* article, the heading depths won't make sense!
 * ```
 * <h1>the supreme article!!</h1>
 * <h1>welcome to my section!</h1>
 * <p>some text!<p>
 * ```
 * 
 * This is unceremoniously resolved by having pseudo-h1 elements that are actually relative to the section in which
 * they're presented. You can either do 'traditional' h1, h2 etc; or you can just do `<Section/>` and `<Header/>`.
 */

import React, { RefAttributes } from 'react';
import style from 'linear2/features/elements/base.module.sass';
import { classes, PropsOf, prettyAnchor } from '../util';
import { Provide as ProvideSectionOutline } from './outlineState';

export type HeaderDepth = 0 | 1 | 2 | 3 | 4 | 5;

export const SectionDepthContext = React.createContext<HeaderDepth>(0);

export interface HeadingProps extends Omit<PropsOf<'h1'>, 'ref'> {
    depth: HeaderDepth;
}

export type HeaderComponent =
    typeof H1 | typeof H2 | typeof H3 | typeof H4 | typeof H5 | typeof Heading

export const H1 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, "depth">>(
    (props, ref) => <Heading depth={0} ref={ref} {...props}/>);

export const H2 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, "depth">>(
    (props, ref) => <Heading depth={1} ref={ref} {...props}/>);

export const H3 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, "depth">>(
    (props, ref) => <Heading depth={2} ref={ref} {...props}/>);

export const H4 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, "depth">>(
    (props, ref) => <Heading depth={3} ref={ref} {...props}/>);

export const H5 = React.forwardRef<HTMLHeadingElement, Omit<HeadingProps, "depth">>(
    (props, ref) => <Heading depth={4} ref={ref} {...props}/>);

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
    ({ depth, children, ...props }, ref) => {
        const sectionDepth = React.useContext(SectionDepthContext);

        const elementName = ([
            'h1', 'h2', 'h3', 'h4', 'h5'
        ] as const)[depth + sectionDepth] ?? 'h5';

        return React.createElement(elementName, {
            ...props,
            ref,
            ...classes(props.className, style.linear)
        }, <>
            {props.id?<>
                <a href={`#${props.id}`} aria-label="section link">§</a>
                {" "}
            </>: null }
            {children}
        </>);
    }
);

type HTMLSectionElement = HTMLElement;

export const useText:
    () => [ ref: (element: { innerText: string } | null) => void, value?: string ]
=
    () => {
        const [ text, setText ] = React.useState<string>();
        const onElementMount = React.useCallback((v: { innerText: string} | null) =>
            v !== null? setText(v.innerText): void 0, [ setText ]);

        return [ onElementMount, text ];
    }
;

export type HeadingElement<T extends HeaderComponent = HeaderComponent> = React.ReactElement<HeadingProps & RefAttributes<HTMLHeadingElement>, T>

export interface SectionProps extends Omit<PropsOf<'section'>, 'ref'> {
    children: [ HeadingElement, ...React.ReactElement[]];
}

function mergeRefs<T = any>(
  ...refs: Array<React.MutableRefObject<T> | React.LegacyRef<T>>
): React.RefCallback<T> {
  return (value) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

function isDefined<T>(v: T | undefined): v is T { return v !== undefined }

export const Section = React.forwardRef<HTMLSectionElement, SectionProps> (
    ({ children: [ heading, ...children ], ...props}, ref) => {
        let sectionDepth = React.useContext(SectionDepthContext);
        if (sectionDepth > 5) sectionDepth = 5;

        const [ onHeadingMount, headingText ] = useText();

        const id = prettyAnchor(heading.props.id ?? headingText);

        const headingElement = React.cloneElement(heading, {
                    ...heading.props,
                    ref: mergeRefs(...[heading.props.ref, onHeadingMount].filter(isDefined)),
                    id,
                }, heading.props.children )

        let o = <section {...{
            ...props,
            ...classes(props.className, style.linear)
        }} ref={ref} aria-labelledby={id}>
            {headingElement}
            {children.map((v, i) => <React.Fragment key={i}>{v}</React.Fragment>)}
        </section>;

        o = <SectionDepthContext.Provider value={sectionDepth}>{o}</SectionDepthContext.Provider>;
        o = <ProvideSectionOutline element={headingElement as HeadingElement}>{o}</ProvideSectionOutline>


        return o;
    }
);


