import { afterEach, expect, it, jest } from '@jest/globals';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import type { MarkdownComponents } from './markdown_components.js';

jest.unstable_mockModule('./style.module.css', () => ({
	default: { codeKeyword: 'keyword', codeLiteral: 'literal' },
}));
jest.unstable_mockModule(
	'#root/project/me/zemn/components/Link/link.module.css',
	() => ({
		default: { link: 'canonicalLink' },
	})
);
jest.unstable_mockModule('#root/ts/react/next/Link/Link.module.css', () => ({
	default: {},
}));
// Keep the MDX adapter real; its surrounding metadata/layout is tested separately.
jest.unstable_mockModule('./article.js', () => ({
	Article: ({ children }: { readonly children?: ReactNode }) => (
		<article>{children}</article>
	),
}));

const { Markdown } = await import('./markdown.js');
const { MDXArticle } = await import('./mdx_article.js');
const { markdownComponents } = await import('./markdown_components.js');

let root: Root | undefined;
afterEach(async () => {
	await act(async () => root?.unmount());
});
async function render(node: ReactNode) {
	const container = document.createElement('div');
	root = createRoot(container);
	await act(async () => root?.render(node));
	return container;
}

// Compiled MDX receives its element renderers through this components prop.
function MDXContent({
	components = {},
}: {
	readonly components?: MarkdownComponents;
}) {
	const Anchor = components.a ?? 'a';
	const H2 = components.h2 ?? 'h2';
	const Pre = components.pre ?? 'pre';
	return (
		<>
			<H2 id="topic">Topic</H2>
			<p>
				<Anchor href="https://example.com" title="Source">
					Reference
				</Anchor>
			</p>
			<Pre>
				<code className="language-js">{'const ok = true;\n'}</code>
			</Pre>
		</>
	);
}

it('renders MDX and runtime links through the canonical component', async () => {
	const container = await render(
		<>
			<MDXArticle>
				<MDXContent />
			</MDXArticle>
			<Markdown>
				{
					'## Topic\n\n[Reference](https://example.com "Source")\n\n```js\nconst ok = true;\n```'
				}
			</Markdown>
		</>
	);
	const links = container.querySelectorAll('a');
	expect(links).toHaveLength(2);
	for (const link of links) {
		expect(link.classList.contains('canonicalLink')).toBe(true);
		expect(link.target).toBe('_blank');
		expect(link.rel).toBe('external');
		expect(link.title).toBe('Source');
	}
	for (const heading of container.querySelectorAll('h2'))
		expect(heading.id).not.toBe('');
	expect(
		container.querySelectorAll('pre[data-code-language="js"] code .keyword')
	).toHaveLength(2);
	expect(container.querySelector('[node]')).toBeNull();
});

it('keeps shared defaults when either renderer overrides one element', async () => {
	const components = {
		h2: markdownComponents.h4,
	} satisfies MarkdownComponents;
	const container = await render(
		<>
			<MDXArticle components={components}>
				<MDXContent />
			</MDXArticle>
			<Markdown components={components}>
				{'## Topic\n\n[Reference](https://example.com)'}
			</Markdown>
		</>
	);
	expect(container.querySelectorAll('h4')).toHaveLength(2);
	expect(container.querySelector('h2')).toBeNull();
	expect(container.querySelectorAll('a.canonicalLink')).toHaveLength(2);
});

it('lets specialized links delegate to the shared renderer', async () => {
	const clicked = jest.fn();
	const Anchor = markdownComponents.a;
	const container = await render(
		<Markdown
			components={{
				a: props => (
					<Anchor
						{...props}
						onClick={event => {
							event.preventDefault();
							clicked();
						}}
					/>
				),
			}}
		>
			{'## Evidence\n\n[Play source](/journal?entry=sample)'}
		</Markdown>
	);
	const link = container.querySelector<HTMLAnchorElement>('a.canonicalLink');
	expect(link?.getAttribute('href')).toBe('/journal?entry=sample');
	await act(async () => link?.click());
	expect(clicked).toHaveBeenCalledTimes(1);
	expect(container.querySelector('h2')?.id).toMatch(/^evidence-/);
	expect(container.querySelector('[node]')).toBeNull();
});

it('does not execute HTML or JSX in runtime Markdown', async () => {
	const container = await render(
		<Markdown>
			{
				'<script>throw new Error("executed")</script>\n\n<img src="x" onerror="alert(1)" />'
			}
		</Markdown>
	);
	expect(container.querySelector('script, img')).toBeNull();
	expect(container.textContent).toContain('<script>');
});
