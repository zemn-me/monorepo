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

import * as elements from 'linear2/features/elements';
import style from 'linear2/features/elements/base.module.sass';
import * as fancy from 'linear2/features/elements/fancy';
import React, { RefAttributes } from 'react';

import { extractText } from '../extractText';
import { classes, prettyAnchor, PropsOf } from '../util';
import { Provide as ProvideSectionOutline } from './outlineState';

export type HeaderDepth = 0 | 1 | 2 | 3 | 4 | 5;

export const SectionDepthContext = React.createContext<HeaderDepth>(0);

export interface HeadingProps extends Omit<PropsOf<'h1'>, 'ref'> {
	depth: HeaderDepth;
}

export type HeaderComponent =
	| typeof H1
	| typeof H2
	| typeof H3
	| typeof H4
	| typeof H5
	| typeof Heading;

export const H1 = React.forwardRef<
	HTMLHeadingElement,
	Omit<HeadingProps, 'depth'>
>((props, ref) => <Heading depth={0} ref={ref} {...props} />);

export const H2 = React.forwardRef<
	HTMLHeadingElement,
	Omit<HeadingProps, 'depth'>
>((props, ref) => <Heading depth={1} ref={ref} {...props} />);

export const H3 = React.forwardRef<
	HTMLHeadingElement,
	Omit<HeadingProps, 'depth'>
>((props, ref) => <Heading depth={2} ref={ref} {...props} />);

export const H4 = React.forwardRef<
	HTMLHeadingElement,
	Omit<HeadingProps, 'depth'>
>((props, ref) => <Heading depth={3} ref={ref} {...props} />);

export const H5 = React.forwardRef<
	HTMLHeadingElement,
	Omit<HeadingProps, 'depth'>
>((props, ref) => <Heading depth={4} ref={ref} {...props} />);

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
	({ depth = 0, children, ...props }, ref) => {
		const sectionDepth = React.useContext(SectionDepthContext);

		const elementName =
			(['h1', 'h1', 'h2', 'h3', 'h4', 'h5'] as const)[
				depth + sectionDepth
			] ?? 'h5';

		return React.createElement(
			elementName,
			{
				...props,
				ref,
				...classes(props.className, style.linear),
			},
			children
		);
	}
);

export type HTMLSectionElement = HTMLElement;

export const useText: () => [
	ref: (element: { innerText: string } | null) => void,
	value?: string
] = () => {
	const [text, setText] = React.useState<string>();
	const onElementMount = React.useCallback(
		(v: { innerText: string } | null | { textContent: string }) =>
			v !== null
				? setText(
						(() => {
							if ('innerText' in v) return v.innerText;
							if ('textContent' in v) return v.textContent;
							return '';
						})()
				  )
				: void 0,
		[setText]
	);

	return [onElementMount, text];
};

export type HeadingElement<T extends HeaderComponent = HeaderComponent> =
	React.ReactElement<HeadingProps & RefAttributes<HTMLHeadingElement>, T>;

export function mergeRefs<T = any>(
	...refs: Array<React.MutableRefObject<T> | React.LegacyRef<T>>
): React.RefCallback<T> {
	return value => {
		refs.forEach(ref => {
			if (typeof ref === 'function') {
				ref(value);
			} else if (ref != null) {
				(ref as React.MutableRefObject<T | null>).current = value;
			}
		});
	};
}

export function isDefined<T>(v: T | undefined): v is T {
	return v !== undefined;
}

export interface SectionProps extends Omit<PropsOf<'section'>, 'ref'> {
	children: [HeadingElement, ...React.ReactElement[]];
	withSectionMarkers?: boolean;
	sectionChildWrapperClass?: string;
}

export const Section = React.forwardRef<HTMLSectionElement, SectionProps>(
	(
		{
			children: [heading, ...children],
			withSectionMarkers,
			sectionChildWrapperClass,
			...props
		},
		ref
	) => {
		let sectionDepth = React.useContext(SectionDepthContext);
		sectionDepth = (sectionDepth + 1) as any;
		if (sectionDepth > 5) sectionDepth = 5;

		const headingText = extractText(heading as any);

		const id = prettyAnchor(heading.props.id ?? headingText);

		const headingElement = React.cloneElement(
			heading,
			{
				...heading.props,
				id,
			},
			heading.props.children
		);

		let o = headingElement;

		if (withSectionMarkers)
			o = (
				<header
					className={[
						fancy.style.sectionHeader,
						fancy.style[`h${sectionDepth}`],
					]
						.filter(isDefined)
						.join('')}
				>
					<div className={fancy.style.sectionLink}>
						<a href={`#${id}`} />
					</div>
					{React.cloneElement(
						o,
						{
							...o.props,
							...classes(o.props.className, fancy.style.title),
						},
						o.props.children
					)}
				</header>
			);

		o = (
			<section
				{...{
					...props,
					...classes(
						props.className,
						style.linear,
						[
							fancy.style.sectionDepth1,
							fancy.style.sectionDepth1,
							fancy.style.sectionDepth2,
							fancy.style.sectionDepth3,
							fancy.style.sectionDepth4,
							fancy.style.sectionDepth5,
						][sectionDepth]
					),
				}}
				aria-labelledby={id}
				ref={ref}
			>
				{o}
				<span
					{...elements.util.classes(
						fancy.style.sectionWrapper,
						sectionChildWrapperClass
					)}
				>
					{children.map((v, i) => (
						<React.Fragment key={i}>{v}</React.Fragment>
					))}
				</span>
			</section>
		);

		o = (
			<SectionDepthContext.Provider value={sectionDepth}>
				{o}
			</SectionDepthContext.Provider>
		);
		o = (
			<ProvideSectionOutline element={headingElement as HeadingElement}>
				{o}
			</ProvideSectionOutline>
		);

		return o;
	}
);
