import {
	afterEach,
	beforeAll,
	beforeEach,
	expect,
	it,
	jest,
} from '@jest/globals';
import { raf } from '@react-spring/rafz';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import type { GladeProps } from './glade.js';

let pathname = '/article/example';
let reducedMotion = false;

jest.unstable_mockModule('react-router', () => ({
	useLocation: () => ({ pathname: pathname }),
	useNavigate: () => jest.fn(),
}));

jest.unstable_mockModule(
	'#root/project/me/zemn/components/Glade/style.module.css',
	() => ({
		default: {
			banner: 'banner',
			content: 'content',
			copyright: 'copyright',
			footer: 'footer',
			footerEmblem: 'footerEmblem',
			fullName: 'fullName',
			handle: 'handle',
			headerBgv: 'headerBgv',
			letterHead: 'letterHead',
			logo: 'logo',
			main: 'main',
		},
	})
);

jest.unstable_mockModule(
	'#root/project/me/zemn/components/DividerHeading/index.js',
	() => ({
		dividerHeadingClass: 'dividerHeading',
	})
);

jest.unstable_mockModule(
	'#root/project/me/zemn/components/Glade/menu.js',
	() => ({
		GladeMenu: () => <nav aria-label="Site" />,
	})
);

jest.unstable_mockModule(
	'#root/project/me/zemn/components/HeroVideo/hero_video.js',
	() => ({
		HeroVideo: (props: {
			readonly className?: string;
			readonly 'data-glade-banner'?: boolean;
		}) => (
			<figure
				className={props.className}
				data-glade-banner={props['data-glade-banner']}
			/>
		),
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

jest.unstable_mockModule(
	'#root/project/me/zemn/components/TimeEye/index.js',
	() => ({
		TimeEye: ({ className }: { readonly className?: string }) => (
			<svg className={className} />
		),
	})
);

jest.unstable_mockModule(
	'#root/project/me/zemn/components/ZemnmezLogo/ZemnmezLogo.module.css',
	() => ({ default: { zemnmezLogo: 'zemnmezLogo' } })
);

jest.unstable_mockModule('#root/project/me/zemn/bio/index.js', () => ({
	Bio: {
		who: {
			fullName: {
				language: 'en',
				text: 'Thomas NJ Shadwell',
			},
			handle: {
				language: 'en',
				text: 'Zemnmez',
			},
		},
	},
}));

jest.unstable_mockModule('#root/ts/constants/constants.js', () => ({
	repoFirstCommitYear: 2008,
}));

jest.unstable_mockModule('#root/ts/react/lang/index.js', () => ({
	text: (value: string | { readonly text: string }) =>
		typeof value === 'string' ? value : value.text,
}));

let Glade: (props: GladeProps) => React.JSX.Element;
let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
	Glade = (await import('./glade.js')).default;
});

beforeEach(() => {
	pathname = '/article/example';
	reducedMotion = false;
	Object.defineProperty(window, 'matchMedia', {
		configurable: true,
		value: (media: string) => ({
			media,
			matches: reducedMotion,
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		}),
	});
	jest.useFakeTimers();
	raf.frameLoop = 'demand';
	container = document.createElement('div');
	root = createRoot(container);
	document.body.appendChild(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	jest.useRealTimers();
});

it('renders article content before the hero video in the DOM', () => {
	act(() => {
		root.render(
			<Glade>
				<article>Article body</article>
			</Glade>
		);
	});

	const main = container.querySelector('[data-glade-layout]');
	const content = container.querySelector('[data-glade-content]');
	const heroVideo = container.querySelector('figure[data-glade-banner]');

	expect(main?.firstElementChild).toBe(content);
	expect(Array.from(main!.children).indexOf(content!)).toBeLessThan(
		Array.from(main!.children).indexOf(heroVideo!)
	);
});

function footerLogoTitle() {
	const emblem = container.querySelector('[data-glade-footer] svg');
	expect(emblem).not.toBeNull();
	return emblem?.querySelector('title')?.textContent ?? null;
}

it.each([
	[2027, 1, 2, null],
	[2027, 1, 3, 'Zemnmez Logo'],
	[2028, 1, 3, 'Zemnmez Logo'],
	[2027, 1, 4, null],
	[2027, 2, 3, null],
])(
	'selects the footer emblem on local date %i/%i/%i',
	(year, month, day, title) => {
		jest.setSystemTime(new Date(year, month, day, 12));
		act(() => root.render(<Glade />));
		expect(footerLogoTitle()).toBe(title);
	}
);

it('switches into and out of the anniversary while the page stays open', () => {
	jest.setSystemTime(new Date(2027, 1, 2, 23, 59));
	act(() => root.render(<Glade />));
	expect(footerLogoTitle()).toBe(null);

	act(() => jest.advanceTimersByTime(60_000));
	expect(footerLogoTitle()).toBe('Zemnmez Logo');

	jest.setSystemTime(new Date(2027, 1, 3, 23, 59));
	act(() => jest.advanceTimersByTime(60_000));
	expect(footerLogoTitle()).toBe(null);
});

function loadingStatus() {
	return container.querySelector(
		'[role="status"][aria-label="Loading page"]'
	);
}

it('shows navigation feedback after 200 ms and hides it when navigation finishes', () => {
	act(() => root.render(<Glade navigationPending />));
	act(() => jest.advanceTimersByTime(199));
	expect(loadingStatus()).toBeNull();
	act(() => jest.advanceTimersByTime(1));
	expect(loadingStatus()).not.toBeNull();
	act(() => root.render(<Glade navigationPending={false} />));
	expect(loadingStatus()).toBeNull();
});

it('cancels feedback for quick navigation and gives the next navigation its own delay', () => {
	act(() => root.render(<Glade navigationPending />));
	act(() => jest.advanceTimersByTime(100));
	act(() => root.render(<Glade navigationPending={false} />));
	act(() => jest.advanceTimersByTime(500));
	expect(loadingStatus()).toBeNull();
	act(() => root.render(<Glade navigationPending />));
	act(() => jest.advanceTimersByTime(199));
	expect(loadingStatus()).toBeNull();
	act(() => jest.advanceTimersByTime(1));
	expect(loadingStatus()).not.toBeNull();
});

function advanceSpring(milliseconds: number) {
	for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
		act(() => {
			jest.advanceTimersByTime(16);
			raf.advance();
		});
	}
}

function rayLength() {
	return Number(container.querySelector('svg line')?.getAttribute('x2'));
}

it('grows and retracts ray geometry with the navigation state', () => {
	act(() => root.render(<Glade navigationPending />));
	expect(rayLength()).toBe(0);
	act(() => jest.advanceTimersByTime(500));
	advanceSpring(80);
	const growingLength = rayLength();
	expect(growingLength).toBeGreaterThan(0);
	advanceSpring(400);
	expect(rayLength()).toBeGreaterThan(growingLength);
	act(() => root.render(<Glade navigationPending={false} />));
	advanceSpring(600);
	expect(rayLength()).toBe(0);
});

it('shows and hides full ray geometry immediately with reduced motion', () => {
	reducedMotion = true;
	act(() => root.render(<Glade navigationPending />));
	act(() => jest.advanceTimersByTime(500));
	advanceSpring(16);
	expect(rayLength()).toBeGreaterThan(0);
	act(() => root.render(<Glade navigationPending={false} />));
	expect(rayLength()).toBe(0);
});
