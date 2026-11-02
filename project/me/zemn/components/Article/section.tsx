'use client';
import { useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { tocSegment } from '#root/project/me/zemn/components/Article/toc_context.js';

export type SectionProps = React.JSX.IntrinsicElements['section'];

export function Section({ children, ...props }: SectionProps) {
	const portals = useContext(tocSegment);
	const [childTocSegments, setChildTocSegments] = useState<
		Record<number, HTMLOListElement | null>
	>({});

	// Keep ref callbacks stable while the set of contents targets is unchanged.
	const portalCount = portals.length;
	const childRefs = useMemo(
		() =>
			Array.from({ length: portalCount }, (_, index) =>
				(element: HTMLOListElement | null) => {
					setChildTocSegments(segments =>
						segments[index] === element
							? segments
							: { ...segments, [index]: element }
					);
				}
			),
		[portalCount]
	);

	const childPortals = portals
		.map((_, index) => childTocSegments[index])
		.filter((portal): portal is HTMLOListElement => portal != null);

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
					<ol ref={childRefs[index]} />,
					portal,
					String(index)
				)
			)}
		</section>
	);
}
