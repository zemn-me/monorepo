import { expect, it, jest } from '@jest/globals';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';

jest.unstable_mockModule(
	'#root/project/me/zemn/components/CopyrightNotices/style.module.css',
	() => ({ default: { notices: 'notices' } })
);
const { CopyrightNotices, useVisibleCopyright } = await import('./index.js');

function Illustration({ name, credit }: { name: string; credit: string }) {
	const [target, setTarget] = useState<HTMLElement | null>(null);
	useVisibleCopyright(target, { key: credit, content: credit });
	return <figure aria-label={name} ref={setTarget} />;
}

it('credits each visible source once and removes it when its last illustration leaves or unmounts', () => {
	const callbacks = new Map<Element, (visible: boolean) => void>();
	const original = globalThis.IntersectionObserver;
	Object.defineProperty(globalThis, 'IntersectionObserver', {
		configurable: true,
		value: class {
			private target?: Element;
			constructor(
				private callback: (
					entries: { isIntersecting: boolean }[]
				) => void
			) {}
			observe(element: Element) {
				this.target = element;
				callbacks.set(element, visible =>
					this.callback([{ isIntersecting: visible }])
				);
			}
			disconnect() {
				if (this.target) callbacks.delete(this.target);
			}
		},
	});
	const host = document.body.appendChild(document.createElement('div'));
	const root = createRoot(host);
	const show = (name: string, visible: boolean) => {
		const element = host.querySelector(`[aria-label="${name}"]`)!;
		act(() => callbacks.get(element)!(visible));
	};
	const credits = () =>
		Array.from(document.querySelectorAll('aside li'), li => li.textContent);
	const render = (showSecond: boolean) =>
		act(() =>
			root.render(
				<CopyrightNotices>
					<Illustration name="First map" credit="Map source" />
					{showSecond && (
						<Illustration name="Second map" credit="Map source" />
					)}
					<Illustration name="Photo" credit="Photographer" />
				</CopyrightNotices>
			)
		);
	try {
		render(true);
		expect(credits()).toEqual([]);
		show('First map', true);
		show('Second map', true);
		show('Photo', true);
		expect(credits()).toEqual(['Map source', 'Photographer']);
		show('First map', false);
		expect(credits()).toEqual(['Map source', 'Photographer']);
		render(false);
		expect(credits()).toEqual(['Photographer']);
		show('Photo', false);
		expect(document.querySelector('aside')).toBeNull();
	} finally {
		act(() => root.unmount());
		host.remove();
		Object.defineProperty(globalThis, 'IntersectionObserver', {
			configurable: true,
			value: original,
		});
	}
});
