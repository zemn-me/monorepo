import React from 'react';
//import { PrismAsyncLight as SyntaxHighlighter  } from 'react-syntax-highlighter';
import type * as highlight from 'react-syntax-highlighter';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

import style from './syntaxHighlighting.module.sass';

declare module 'react-syntax-highlighter' {
	type Style = any;

	type ValueOf<T> = T[keyof T];

	export interface RendererProps {
		rows: Node[];
		stylesheet: Style;
		useInlineStyles: boolean;
	}

	export type Node = TextRow | Element;

	// https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/f74b9dff3c819832242d61632956801816b4f32d/src/highlight.js
	export interface TextRow {
		type: 'text';
		value: string;
	}

	type Properties<
		T extends keyof JSX.IntrinsicElements = keyof JSX.IntrinsicElements
	> = { className: string[] } & Omit<JSX.IntrinsicElements[T], 'className'>;

	type Element<
		T extends keyof JSX.IntrinsicElements = keyof JSX.IntrinsicElements
	> = __Element & { tagName: T };

	type __Element = ValueOf<{
		[k in keyof JSX.IntrinsicElements]: _Element<k>;
	}>;

	interface _Element<
		T extends keyof JSX.IntrinsicElements = keyof JSX.IntrinsicElements
	> {
		type: 'element';
		tagName: T;
		children: Node[];
		properties: Properties<T>;
	}
	export interface SyntaxHighlighterProps {
		/**
		 * Defines a custom renderer, which takes the generated
		 * AST and returns a `React.ReactNode\.
		 * @see React.ReactNode
		 */
		renderer?: (props: RendererProps) => React.ReactNode;
	}
}

export interface CodeProps {
	children: string;
	language?: string;
	lineNumbers?: boolean;
	name?: string;
}

const Span: (props: highlight.Element<'span'>) => React.ReactElement | null = ({
	properties,
	children,
}) => {
	const classes = properties.className
		.map(k => style[k])
		.filter(<T, >(v: T | undefined): v is T => v !== undefined);

	if (classes.length === 0)
		return (
			<>
				{children.map((c, i) => (
					<Node key={i} {...c} />
				))}
			</>
		);

	return (
		<span
			{...{
				...properties,
				className: classes.join(' '),
			}}
		>
			{children.map((c, i) => (
				<Node key={i} {...c} />
			))}
		</span>
	);
};
const Node: (props: highlight.Node) => React.ReactElement | null = props => {
	switch (props.type) {
		case 'text':
			return <>{props.value}</>;
		case 'element':
			if (props.tagName === 'span') return <Span {...props} />;
			return <Element {...props} />;
		default:
			throw new Error(`undefined node type ${(props as any).type}`);
	}
};
const Element: (props: highlight.Element) => React.ReactElement = props => {
	console.log(props);
	return React.createElement(
		props.tagName,
		{
			...props.properties,
		},
		props?.children?.map((element, i) => <Node key={i} {...element} />)
	);
};
const renderer: (props: highlight.RendererProps) => React.ReactNode = ({
	rows,
}) => (
	<>
		{rows.map((row, i) => (
			<Node key={i} {...row} />
		))}
	</>
);

export const CodeBlock: React.FC<CodeProps> = ({
	children,
	language,
	name,
	lineNumbers = false,
}) => {
	let o = (
		<SyntaxHighlighter
			className={style.code}
			customStyle={{ backgroundColor: undefined }}
			language={language?.toLowerCase() ?? ''}
			renderer={renderer}
			showLineNumbers={lineNumbers}
			style={{}}
		>
			{children.trim()}
		</SyntaxHighlighter>
	);

	if (name)
		o = (
			<figure>
				<figcaption>{name}</figcaption>
				{o}
			</figure>
		);

	return o;
};
