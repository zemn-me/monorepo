'use client';
import { useContext, useState } from 'react';
import { createPortal } from 'react-dom';

import { tocSegment } from '#root/project/me/zemn/components/Article/toc_context.js';

export type SectionProps = JSX.IntrinsicElements['section'];

export function Section({ children, ...props }: SectionProps) {
	const portals = useContext(tocSegment);
	const [childTocSegments, setChildTocSegments] = useState<
		Record<number, HTMLOListElement | null>
	>({});

	const childPortals = portals
		.map((_, index) => childTocSegments[index])
		.filter((portal): portal is HTMLOListElement => portal !== null);

	return (
		<section {...props}>
			<tocSegment.Provider value={childPortals}>
				{children}
			</tocSegment.Provider>

			{/*
			if a table of contents portal is provided,
			add this section to it.
		*/}
			{portals.map((portal, index) =>
				createPortal(
					<ol
						ref={element =>
							setChildTocSegments(segments =>
								segments[index] === element
									? segments
									: { ...segments, [index]: element }
							)
						}
					/>,
					portal,
					index
				)
			)}
		</section>
	);
}
