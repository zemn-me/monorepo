"use client";
import { useContext, useState } from "react";
import { createPortal } from "react-dom";

import { tocSegment } from "#root/project/zemn.me/components/Article/toc_context.js";


export type SectionProps = JSX.IntrinsicElements["section"];

export function Section({ children, ...props }: SectionProps) {
	const portal = useContext(tocSegment);
	const [ childTocSegment, setChildTocSegment] = useState<HTMLOListElement | null>(null);

	return <section {...props}>

		<tocSegment.Provider value={childTocSegment}>
			{children}
		</tocSegment.Provider>

		{/*
			if a table of contents portal is provided,
			add this section to it.
		*/}
		{
			portal !== null

				? createPortal(
					<ol ref={setChildTocSegment}/>,
					portal
				)
			:null
		}
	</section>
}
