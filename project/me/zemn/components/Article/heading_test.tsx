import { afterEach, beforeEach, expect, it } from '@jest/globals';
import { ReactNode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { H1, H2 } from './heading.js';
import { tocSegment } from './toc_context.js';

function TocHarness({ children }: { readonly children?: ReactNode }) {
	const [toc, setToc] = useState<HTMLUListElement | null>(null);

	return (
		<>
			<ul ref={setToc} />
			<tocSegment.Provider value={toc === null ? [] : [toc]}>
				{children}
			</tocSegment.Provider>
		</>
	);
}

function DualTocHarness({ children }: { readonly children?: ReactNode }) {
	const [tocA, setTocA] = useState<HTMLUListElement | null>(null);
	const [tocB, setTocB] = useState<HTMLUListElement | null>(null);
	const tocTargets = [tocA, tocB].filter(
		(toc): toc is HTMLUListElement => toc !== null
	);

	return (
		<>
			<ul data-toc="a" ref={setTocA} />
			<ul data-toc="b" ref={setTocB} />
			<tocSegment.Provider value={tocTargets}>
				{children}
			</tocSegment.Provider>
		</>
	);
}

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

it('links generated table-of-contents entries to their headings', () => {
	act(() => {
		root.render(
			<TocHarness>
				<H2>
					Useful <em>Section</em>
				</H2>
			</TocHarness>
		);
	});

	const heading = container.querySelector('h2');
	const link = container.querySelector('li[data-toc-heading-level="2"] > a');

	expect(heading?.id).toMatch(/^useful-section-/);
	expect(link?.getAttribute('href')).toBe(
		`#${encodeURIComponent(heading!.id)}`
	);
	expect(link?.textContent).toBe('Useful Section');
});

it('preserves explicit heading ids for table-of-contents links', () => {
	act(() => {
		root.render(
			<TocHarness>
				<H1 id="given-section">Given Section</H1>
			</TocHarness>
		);
	});

	const heading = container.querySelector('h1');
	const link = container.querySelector('li[data-toc-heading-level="1"] > a');

	expect(heading?.id).toBe('given-section');
	expect(link?.getAttribute('href')).toBe('#given-section');
	expect(link?.textContent).toBe('Given Section');
});

it('adds heading links to every table-of-contents target', () => {
	act(() => {
		root.render(
			<DualTocHarness>
				<H2>Mirrored Section</H2>
			</DualTocHarness>
		);
	});

	const links = container.querySelectorAll(
		'li[data-toc-heading-level="2"] > a'
	);

	expect(links).toHaveLength(2);
	expect(
		Array.from(links, link => link.textContent)
	).toEqual(['Mirrored Section', 'Mirrored Section']);
});

it('uses inline heading id markers for table-of-contents links', () => {
	act(() => {
		root.render(
			<TocHarness>
				<H2>
					<span data-heading-id="legacy_section" />
					Legacy Section
				</H2>
			</TocHarness>
		);
	});

	const heading = container.querySelector('h2');
	const link = container.querySelector('li[data-toc-heading-level="2"] > a');

	expect(heading?.id).toBe('legacy_section');
	expect(link?.getAttribute('href')).toBe('#legacy_section');
	expect(link?.textContent).toBe('Legacy Section');
});
