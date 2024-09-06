"use client";
import { useContext } from "react"
import { createPortal } from "react-dom";

import { tocSegment } from "#root/project/zemn.me/components/Article/toc_context.js"


type BaseHeadingProps = JSX.IntrinsicElements["h1"]

export interface HeadingProps extends BaseHeadingProps {
	readonly level: 1 | 2 | 3 | 4 | 5
}

export function Heading({ level, children, ...props }: HeadingProps) {
	const portal = useContext(tocSegment);

	const element = {
		1: <h1 {...{ children, ...props }} />,
		2: <h2 {...{ children, ...props }} />,
		3: <h3 {...{ children, ...props }} />,
		4: <h4 {...{ children, ...props }} />,
		5: <h5 {...{ children, ...props }} />,
	}[level];
	return <>
		{element}
		{
			portal !== null

			? createPortal(
				<li>{children}</li>,
				portal
			)
			:null
		}
	</>
}

export function H1(props: BaseHeadingProps) { return <Heading level={1} {...props} /> }
export function H2(props: BaseHeadingProps) { return <Heading level={2} {...props} /> }
export function H3(props: BaseHeadingProps) { return <Heading level={3} {...props} /> }
export function H4(props: BaseHeadingProps) { return <Heading level={4} {...props} /> }
export function H5(props: BaseHeadingProps) { return <Heading level={5} {...props} /> }




