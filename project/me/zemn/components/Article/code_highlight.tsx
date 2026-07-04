import {
	Children,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from 'react';
import { refractor } from 'refractor';
import http from 'refractor/http';
import uri from 'refractor/uri';

import style from '#root/project/me/zemn/components/Article/style.module.css';

refractor.register(http);
refractor.register(uri);
refractor.alias('uri', 'query');

type CodeElement = ReactElement<{
	readonly children?: ReactNode;
	readonly className?: string;
}>;

interface RefractorText {
	readonly type: 'text';
	readonly value: string;
}

interface RefractorElement {
	readonly type: 'element';
	readonly tagName: string;
	readonly properties?: {
		readonly className?: ReadonlyArray<string> | string;
	};
	readonly children?: readonly RefractorNode[];
}

type RefractorNode = RefractorElement | RefractorText;

const tokenClassByName: Readonly<Record<string, string>> = {
	'attr-name': style.codeKeyword,
	'attr-value': style.codeString,
	boolean: style.codeLiteral,
	builtin: style.codeLiteral,
	char: style.codeString,
	comment: style.codeComment,
	constant: style.codeLiteral,
	deleted: style.codeString,
	entity: style.codeLiteral,
	function: style.codeLiteral,
	important: style.codeKeyword,
	inserted: style.codeLiteral,
	keyword: style.codeKeyword,
	number: style.codeNumber,
	operator: style.codeOperator,
	prolog: style.codeComment,
	property: style.codeLiteral,
	punctuation: style.codePunctuation,
	regex: style.codeString,
	selector: style.codeTag,
	string: style.codeString,
	symbol: style.codeLiteral,
	tag: style.codeTag,
	url: style.codeString,
	variable: style.codeLiteral,
};

function textFromNode(node: ReactNode): string {
	return Children.toArray(node)
		.map(child => {
			if (typeof child === 'string' || typeof child === 'number') {
				return String(child);
			}

			if (
				isValidElement<{ readonly children?: ReactNode }>(child) &&
				child.props.children != null
			) {
				return textFromNode(child.props.children);
			}

			return '';
		})
		.join('');
}

function languageFromClassName(className: string | undefined): string {
	return (
		className
			?.split(/\s+/)
			.find(name => name.startsWith('language-'))
			?.slice('language-'.length)
			.toLowerCase() ?? ''
	);
}

function classNameFromTokenNames(
	className: ReadonlyArray<string> | string | undefined
): string | undefined {
	const names = typeof className === 'string' ? className.split(/\s+/) : className;
	const mappedNames = names
		?.map(name => tokenClassByName[name])
		.filter((name): name is string => name != null);

	return mappedNames?.length ? mappedNames.join(' ') : undefined;
}

function renderRefractorNodes(
	nodes: readonly RefractorNode[] | undefined,
	keyPrefix = 'code'
): ReactNode {
	return nodes?.map((node, index) => {
		const key = `${keyPrefix}-${index}`;

		if (node.type === 'text') {
			return node.value;
		}

		return (
			<span
				className={classNameFromTokenNames(node.properties?.className)}
				key={key}
			>
				{renderRefractorNodes(node.children, key)}
			</span>
		);
	});
}

function highlightedCode(code: string, language: string): ReactNode {
	if (!language || !refractor.registered(language)) {
		return code;
	}

	return renderRefractorNodes(
		refractor.highlight(code, language).children as readonly RefractorNode[]
	);
}

export function CodeBlock({
	children,
	...props
}: JSX.IntrinsicElements['pre']) {
	const codeElement = Children.only(children);

	if (!isValidElement(codeElement) || codeElement.type !== 'code') {
		return <pre {...props}>{children}</pre>;
	}

	const typedCodeElement = codeElement as CodeElement;
	const code = textFromNode(typedCodeElement.props.children);
	const language = languageFromClassName(typedCodeElement.props.className);

	return (
		<pre {...props} data-code-language={language || undefined}>
			<code className={typedCodeElement.props.className}>
				{highlightedCode(code, language)}
			</code>
		</pre>
	);
}
