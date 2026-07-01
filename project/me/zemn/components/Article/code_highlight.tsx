import {
	Children,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from 'react';

import style from '#root/project/me/zemn/components/Article/style.module.css';

type CodeElement = ReactElement<{
	readonly children?: ReactNode;
	readonly className?: string;
}>;

type TokenKind =
	| 'comment'
	| 'keyword'
	| 'literal'
	| 'number'
	| 'operator'
	| 'punctuation'
	| 'string'
	| 'tag'
	| 'text';

interface Token {
	readonly kind: TokenKind;
	readonly text: string;
}

const keywordLanguages = new Set([
	'javascript',
	'js',
	'jsx',
	'ts',
	'tsx',
	'typescript',
]);

const jsKeywords = new Set([
	'async',
	'await',
	'break',
	'case',
	'catch',
	'class',
	'const',
	'continue',
	'default',
	'do',
	'else',
	'export',
	'extends',
	'finally',
	'for',
	'function',
	'if',
	'import',
	'in',
	'let',
	'new',
	'of',
	'return',
	'static',
	'switch',
	'throw',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',
	'yield',
]);

const literals = new Set([
	'false',
	'null',
	'this',
	'true',
	'undefined',
	'window',
	'document',
]);

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

function appendMatches(
	code: string,
	pattern: RegExp,
	kindForMatch: (match: RegExpExecArray) => TokenKind
): Token[] {
	const tokens: Token[] = [];
	let index = 0;

	for (let match = pattern.exec(code); match; match = pattern.exec(code)) {
		if (match.index > index) {
			tokens.push({ kind: 'text', text: code.slice(index, match.index) });
		}

		tokens.push({ kind: kindForMatch(match), text: match[0] });
		index = match.index + match[0].length;
	}

	if (index < code.length) {
		tokens.push({ kind: 'text', text: code.slice(index) });
	}

	return tokens;
}

function tokenizeJavaScript(code: string): Token[] {
	const pattern =
		/\/\/[^\n\r]*|\/\*[\s\S]*?\*\/|`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[{}()[\].,;:?]|[+\-*/%=&|!<>^~]+/g;

	return appendMatches(code, pattern, match => {
		const [text] = match;
		if (text.startsWith('//') || text.startsWith('/*')) return 'comment';
		if (
			text.startsWith('"') ||
			text.startsWith("'") ||
			text.startsWith('`')
		)
			return 'string';
		if (/^\d/.test(text)) return 'number';
		if (jsKeywords.has(text)) return 'keyword';
		if (literals.has(text)) return 'literal';
		if (/^[{}()[\].,;:?]$/.test(text)) return 'punctuation';
		if (/^[+\-*/%=&|!<>^~]+$/.test(text)) return 'operator';
		return 'text';
	});
}

function tokenizeJson(code: string): Token[] {
	return appendMatches(
		code,
		/"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b|[{}[\]:,]/gi,
		match => {
			const [text] = match;
			if (text.startsWith('"')) return 'string';
			if (/^(true|false|null)$/i.test(text)) return 'literal';
			if (/^-?\d/.test(text)) return 'number';
			return 'punctuation';
		}
	);
}

function tokenizeMarkup(code: string): Token[] {
	return appendMatches(
		code,
		/<!--[\s\S]*?-->|<\/?[A-Za-z][^>\s/]*|\/?>|\s+[A-Za-z_:][-A-Za-z0-9_:.]*(?==)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|&[A-Za-z0-9#]+;/g,
		match => {
			const [text] = match;
			if (text.startsWith('<!--')) return 'comment';
			if (text.startsWith('<')) return 'tag';
			if (text === '>' || text === '/>') return 'tag';
			if (text.startsWith('"') || text.startsWith("'")) return 'string';
			if (text.startsWith('&')) return 'literal';
			return 'keyword';
		}
	);
}

function tokenizeHttp(code: string): Token[] {
	return appendMatches(
		code,
		/\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|HTTP\/\d(?:\.\d)?|OK|Host|Origin|Referer|Accept|Content-Security-Policy|X-FRAME-OPTIONS)\b|https?:\/\/[^\s"'<>]+|"(?:\\.|[^"\\])*"|:\s*|[;,]/g,
		match => {
			const [text] = match;
			if (text.startsWith('"')) return 'string';
			if (text.startsWith('http')) return 'literal';
			if (/^[:;,]/.test(text)) return 'punctuation';
			return 'keyword';
		}
	);
}

function tokenize(code: string, language: string): Token[] {
	if (keywordLanguages.has(language)) return tokenizeJavaScript(code);
	if (language === 'json') return tokenizeJson(code);
	if (language === 'html' || language === 'xml') return tokenizeMarkup(code);
	if (language === 'http' || language === 'url' || language === 'query') {
		return tokenizeHttp(code);
	}
	return [{ kind: 'text', text: code }];
}

function tokenClassName(kind: TokenKind): string | undefined {
	return {
		comment: style.codeComment,
		keyword: style.codeKeyword,
		literal: style.codeLiteral,
		number: style.codeNumber,
		operator: style.codeOperator,
		punctuation: style.codePunctuation,
		string: style.codeString,
		tag: style.codeTag,
		text: undefined,
	}[kind];
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
	const tokens = tokenize(code, language);

	return (
		<pre {...props} data-code-language={language || undefined}>
			<code className={typedCodeElement.props.className}>
				{tokens.map((token, index) => (
					<span className={tokenClassName(token.kind)} key={index}>
						{token.text}
					</span>
				))}
			</code>
		</pre>
	);
}
