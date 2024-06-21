"use client";
import { forwardRef, ReactElement } from "react";

import { Outline, OutlineDescription, OutlineSection } from "#root/ts/react/outline/outline.js";

const OutlineRootElement = forwardRef<HTMLDivElement>((_, ref) =>
	<nav id="toc" ref={ref} />
);

const OutlineSectionElement = forwardRef<HTMLOListElement>((_, ref) =>
	<ol ref={ref} />
);

function Section({ children }: { readonly children?: ReactElement | ReactElement[] }) {
	return <OutlineSection element={OutlineSectionElement}>
		{children}
	</OutlineSection>
}

type BaseHeadingProps = JSX.IntrinsicElements["h1"]

interface HeadingProps extends BaseHeadingProps {
	readonly level: 1 | 2 | 3 | 4 | 5
}

function Heading({ level, children, ...props }: HeadingProps) {
	const element = {
		1: <h1 {...{ children, ...props }} />,
		2: <h2 {...{ children, ...props }} />,
		3: <h3 {...{ children, ...props }} />,
		4: <h4 {...{ children, ...props }} />,
		5: <h5 {...{ children, ...props }} />,
	}[level];

	const itemContent = props.id !== undefined ?
		// eslint-disable-next-line react/forbid-elements
		<a href={`#${props.id}`}>{children}</a>
		: <>{ children }</>
	return <>
		<OutlineDescription><li>{itemContent}</li></OutlineDescription>
		<hgroup>
			{/* eslint-disable-next-line react/forbid-elements */}
			{props.id ? <a href={`#${props.id}`}>🔗</a>: null} {element} <a aria-label="table of contents" href="#toc"> ↩</a>
		</hgroup>
	</>
}

export function H1(props: BaseHeadingProps) { return <Heading level={1} {...props} /> }
export function H2(props: BaseHeadingProps) { return <Heading level={2} {...props} /> }
export function H3(props: BaseHeadingProps) { return <Heading level={3} {...props} /> }
export function H4(props: BaseHeadingProps) { return <Heading level={4} {...props} /> }
export function H5(props: BaseHeadingProps) { return <Heading level={5} {...props} /> }



export function OutlineDemoWithLinks() {
	return <Outline element={OutlineRootElement}>
		<Section>
			<H1 id="outline_with_links_welcome">§1: Welcome to my article!</H1>
			<p>Some content in §1.</p>

			<Section>
				<H2 id="outline_with_links_lesser_content">§1.1: Some lesser content!</H2>
				<p>This content is in a subsection!</p>
			</Section>
			<Section>
				<H2 id="outline_with_links_inherits">Inherits <i>any</i> complex HTML</H2>
				<p>↑ yes really!</p>
			</Section>
		</Section>
	</Outline>
}
