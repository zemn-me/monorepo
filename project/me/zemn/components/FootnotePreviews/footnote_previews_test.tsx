import { afterEach, beforeEach, expect, it, jest } from '@jest/globals';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

jest.unstable_mockModule(
	'#root/project/me/zemn/components/FootnotePreviews/style.module.css',
	() => ({ default: { tooltip: 'tooltip' } })
);

const { FootnotePreviews } = await import('./footnote_previews.js');

function FootnoteHarness() {
	const [scope, setScope] = useState<HTMLDivElement | null>(null);
	return (
		<div ref={setScope}>
			<p>
				Text
				<sup>
					<a data-footnote-ref="" href="#fn-1">
						[1]
					</a>
				</sup>
			</p>
			<ol>
				<li id="fn-1">
					The cited passage.{' '}
					<a data-footnote-backref="" href="#fnref-1">
						↩
					</a>
				</li>
			</ol>
			<FootnotePreviews root={scope} />
		</div>
	);
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => root.render(<FootnoteHarness />));
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

it('shows the referenced citation on hover and omits its return link', () => {
	const citation = container.querySelector<HTMLAnchorElement>(
		'a[data-footnote-ref]'
	)!;
	act(() => {
		citation.dispatchEvent(
			new MouseEvent('pointerover', { bubbles: true })
		);
	});

	const tooltip = container.querySelector('[role="tooltip"]');
	expect(tooltip?.textContent).toBe('The cited passage.');
	expect(citation.getAttribute('aria-describedby')).toContain(tooltip?.id);
});

it('uses the first touch tap to open the citation preview', () => {
	const citation = container.querySelector<HTMLAnchorElement>(
		'a[data-footnote-ref]'
	)!;
	const pointerDown = new Event('pointerdown', {
		bubbles: true,
		cancelable: true,
	});
	Object.defineProperty(pointerDown, 'pointerType', { value: 'touch' });
	const click = new MouseEvent('click', { bubbles: true, cancelable: true });

	let followed = true;
	act(() => {
		citation.dispatchEvent(pointerDown);
		// Mobile browsers may focus the link before dispatching its click.
		citation.focus();
		followed = citation.dispatchEvent(click);
	});

	expect(followed).toBe(false);
	expect(container.querySelector('[role="tooltip"]')?.textContent).toBe(
		'The cited passage.'
	);
});
