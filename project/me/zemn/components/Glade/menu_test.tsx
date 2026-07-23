import {
	afterEach,
	beforeAll,
	beforeEach,
	expect,
	it,
	jest,
} from '@jest/globals';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.unstable_mockModule(
	'#root/project/me/zemn/components/Glade/menu.module.css',
	() => ({
		default: {
			hamburgerButton: 'hamburgerButton',
			hamburgerDetails: 'hamburgerDetails',
			hamburgerIconClosed: 'hamburgerIconClosed',
			hamburgerIconOpen: 'hamburgerIconOpen',
			hamburgerLink: 'hamburgerLink',
			hamburgerLinks: 'hamburgerLinks',
			hamburgerMenu: 'hamburgerMenu',
			hamburgerNav: 'hamburgerNav',
			hamburgerSection: 'hamburgerSection',
			hamburgerSectionLabel: 'hamburgerSectionLabel',
			inlineLoginCopy: 'inlineLoginCopy',
		},
	})
);

jest.unstable_mockModule(
	'#root/project/me/zemn/components/InlineLogin/inline_login.js',
	() => ({
		InlineLogin: () => null,
	})
);

interface MockLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
	readonly children?: ReactNode;
	readonly styleless?: boolean;
}

jest.unstable_mockModule(
	'#root/project/me/zemn/components/Link/index.js',
	() => ({
		default: ({
			children,
			styleless: _styleless,
			...props
		}: MockLinkProps) => <a {...props}>{children}</a>,
	})
);

jest.unstable_mockModule('#root/project/me/zemn/hook/useZemnMeApi.js', () => ({
	useGetMeScopes:
		() => (onResolved: (scopes: readonly string[]) => unknown) =>
			onResolved([]),
}));

let isLoggedIn = false;

jest.unstable_mockModule('#root/project/me/zemn/hook/useZemnMeAuth.js', () => ({
	useZemnMeAuth: () => [
		(
			onResolved: (token: string) => unknown,
			_onRejected: () => unknown,
			onPending: () => unknown
		) => (isLoggedIn ? onResolved('token') : onPending()),
	],
}));

let GladeMenu: () => JSX.Element;
let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
	GladeMenu = (await import('./menu.js')).GladeMenu;
});

beforeEach(() => {
	isLoggedIn = false;
	container = document.createElement('div');
	root = createRoot(container);
	document.body.appendChild(container);
});

afterEach(() => {
	root.unmount();
	container.remove();
});

it('keeps the menu open when tapping inside it', () => {
	act(() => {
		root.render(<GladeMenu />);
	});

	const details = container.querySelector('details')!;
	details.open = true;

	act(() => {
		details.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
	});

	expect(details.open).toBe(true);
});

it('retracts the menu when tapping outside it', () => {
	act(() => {
		root.render(<GladeMenu />);
	});

	const details = container.querySelector('details')!;
	const outside = document.createElement('button');
	document.body.appendChild(outside);
	details.open = true;

	act(() => {
		outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
	});

	expect(details.open).toBe(false);
	outside.remove();
});

it('hides availability when signed out', () => {
	act(() => {
		root.render(<GladeMenu />);
	});

	expect(
		Array.from(container.querySelectorAll('a')).some(
			link => link.textContent === 'Availability'
		)
	).toBe(false);
});

it('shows availability when signed in', () => {
	isLoggedIn = true;

	act(() => {
		root.render(<GladeMenu />);
	});

	expect(
		Array.from(container.querySelectorAll('a')).some(
			link => link.textContent === 'Availability'
		)
	).toBe(true);
});
