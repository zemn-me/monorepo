'use client';
import { Children, isValidElement, ReactNode, useContext, useId } from 'react';
import { createPortal } from 'react-dom';

import { tocSegment } from '#root/project/me/zemn/components/Article/toc_context.js';

type BaseHeadingProps = JSX.IntrinsicElements['h1'];

export interface HeadingProps extends BaseHeadingProps {
	readonly level: 1 | 2 | 3 | 4 | 5;
}

function nodeText(node: ReactNode): string {
	return Children.toArray(node)
		.map(child => {
			if (typeof child === 'string' || typeof child === 'number') {
				return String(child);
			}

			if (
				isValidElement<{ readonly children?: ReactNode }>(child) &&
				child.props.children != null
			) {
				return nodeText(child.props.children);
			}

			return '';
		})
		.join(' ');
}

function nodeHeadingId(node: ReactNode): string | undefined {
	for (const child of Children.toArray(node)) {
		if (!isValidElement<{ readonly children?: ReactNode }>(child)) {
			continue;
		}

		const headingId = child.props['data-heading-id'];
		if (typeof headingId === 'string') {
			return headingId;
		}

		const nestedHeadingId = nodeHeadingId(child.props.children);
		if (nestedHeadingId !== undefined) {
			return nestedHeadingId;
		}
	}

	return undefined;
}

function idPart(value: string): string {
	return value
		.normalize('NFKD')
		.toLowerCase()
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function Heading({ level, children, id, ...props }: HeadingProps) {
	const portal = useContext(tocSegment);
	const reactId = useId();
	const fallbackId = idPart(reactId) || 'heading';
	const headingId =
		id ??
		nodeHeadingId(children) ??
		`${idPart(nodeText(children)) || 'heading'}-${fallbackId}`;
	const href = `#${encodeURIComponent(headingId)}`;

	const element = {
		1: <h1 {...{ children, id: headingId, ...props }} />,
		2: <h2 {...{ children, id: headingId, ...props }} />,
		3: <h3 {...{ children, id: headingId, ...props }} />,
		4: <h4 {...{ children, id: headingId, ...props }} />,
		5: <h5 {...{ children, id: headingId, ...props }} />,
	}[level];
	return (
		<>
			{element}
			{portal !== null
				? createPortal(
						<li data-toc-heading-level={level}>
							<a href={href}>{children}</a>
						</li>,
						portal
					)
				: null}
		</>
	);
}

export function H1(props: BaseHeadingProps) {
	return <Heading level={1} {...props} />;
}
export function H2(props: BaseHeadingProps) {
	return <Heading level={2} {...props} />;
}
export function H3(props: BaseHeadingProps) {
	return <Heading level={3} {...props} />;
}
export function H4(props: BaseHeadingProps) {
	return <Heading level={4} {...props} />;
}
export function H5(props: BaseHeadingProps) {
	return <Heading level={5} {...props} />;
}
