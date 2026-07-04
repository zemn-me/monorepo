import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.unstable_mockModule(
	'#root/project/me/zemn/components/Article/style.module.css',
	() => ({
		default: {
			codeComment: 'codeComment',
			codeKeyword: 'codeKeyword',
			codeLiteral: 'codeLiteral',
			codeNumber: 'codeNumber',
			codeOperator: 'codeOperator',
			codePunctuation: 'codePunctuation',
			codeString: 'codeString',
			codeTag: 'codeTag',
		},
	})
);

const { CodeBlock } = await import('./code_highlight.js');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	root.unmount();
	container.remove();
});

it('renders highlighted code as React elements', () => {
	act(() => {
		root.render(
			<CodeBlock>
				<code className="language-js">{'const ok = true;\n'}</code>
			</CodeBlock>
		);
	});

	const code = container.querySelector('code');
	const tokens = code?.querySelectorAll('span');

	expect(code?.textContent).toBe('const ok = true;\n');
	expect(tokens?.length).toBeGreaterThan(0);
	expect(
		Array.from(tokens ?? []).some(token => token.className.length > 0)
	).toBe(true);
});

it('keeps highlighted code text inert', () => {
	act(() => {
		root.render(
			<CodeBlock>
				<code className="language-js">
					{'const html = "<img src=x onerror=alert(1)>";\n'}
				</code>
			</CodeBlock>
		);
	});

	expect(container.querySelector('img')).toBeNull();
	expect(container.querySelector('code')?.textContent).toBe(
		'const html = "<img src=x onerror=alert(1)>";\n'
	);
});
