import { runInThisContext } from 'node:vm';
import { afterEach, expect, it } from '@jest/globals';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
	createMemoryRouter,
	Outlet,
	RouterProvider,
	useNavigate,
} from 'react-router';
import {
	recoverFailedNavigation,
	useNavigationFailure,
} from './navigation_failure.js';

// jsdom omits fetch primitives; use Node's native implementations for the router.
Object.assign(
	globalThis,
	runInThisContext(
		'({ Request, Response, Headers, AbortController, AbortSignal })'
	)
);
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
	value: true,
	configurable: true,
});

let root: Root | undefined;
let router: ReturnType<typeof createMemoryRouter> | undefined;
afterEach(async () => {
	await act(async () => root?.unmount());
	router?.dispose();
});

function Layout() {
	const failure = useNavigationFailure();
	return (
		<>
			<Outlet />
			{failure && (
				<span role="alert" aria-label="Page could not be loaded" />
			)}
		</>
	);
}

function Page() {
	const [value, setValue] = useState('unfinished note');
	const navigate = useNavigate();
	return (
		<>
			<input
				aria-label="Note"
				value={value}
				onChange={event => setValue(event.target.value)}
			/>
			<button onClick={() => void navigate('/next')}>Next</button>
		</>
	);
}

async function setup(load: () => Promise<string>) {
	let initialLoads = 0;
	router = createMemoryRouter([
		{
			id: 'layout',
			middleware: [recoverFailedNavigation],
			Component: Layout,
			children: [
				{
					path: '/',
					loader: () => {
						initialLoads++;
						return null;
					},
					Component: Page,
				},
				{
					path: '/next',
					loader: load,
					element: <h1>Next page</h1>,
					errorElement: <h1>Page error</h1>,
				},
			],
		},
	]);
	const container = document.createElement('div');
	root = createRoot(container);
	await act(async () => root?.render(<RouterProvider router={router!} />));
	return { container, initialLoads: () => initialLoads };
}

it('preserves the previous page and its state after a network failure, then a new navigation succeeds', async () => {
	let reject: (error: Error) => void = () => {
		throw new Error('Loader has not started');
	};
	let attempts = 0;
	const { container, initialLoads } = await setup(() => {
		attempts++;
		return attempts === 1
			? new Promise((_, fail) => {
					reject = fail;
				})
			: Promise.resolve('ready');
	});
	const input = container.querySelector('input');
	await act(async () => container.querySelector('button')?.click());
	await act(async () => reject(new TypeError('Failed to fetch')));
	expect(router?.state.location.pathname).toBe('/');
	expect(container.querySelector('input')).toBe(input);
	expect(input?.value).toBe('unfinished note');
	expect(
		container.querySelector('[role="alert"]')?.getAttribute('aria-label')
	).toBe('Page could not be loaded');
	expect(initialLoads()).toBe(1);
	await act(async () => container.querySelector('button')?.click());
	expect(router?.state.location.pathname).toBe('/next');
	expect(container.textContent).toContain('Next page');
	expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('keeps genuine loader failures in the route error boundary', async () => {
	const { container } = await setup(async () => {
		throw new Error('Server bug');
	});
	await act(async () => container.querySelector('button')?.click());
	expect(router?.state.location.pathname).toBe('/next');
	expect(container.textContent).toContain('Page error');
	expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('recovers when the request fails before the pending UI can render', async () => {
	const { container } = await setup(async () => {
		throw new TypeError('Failed to fetch');
	});
	await act(async () => container.querySelector('button')?.click());
	expect(router?.state.location.pathname).toBe('/');
	expect(container.querySelector('[role="alert"]')).not.toBeNull();
	expect(container.querySelector('input')?.value).toBe('unfinished note');
});

it('does not report a superseded navigation as a connection failure', async () => {
	let reject: (error: Error) => void = () => {
		throw new Error('Loader has not started');
	};
	const { container } = await setup(
		() =>
			new Promise((_, fail) => {
				reject = fail;
			})
	);
	await act(async () => container.querySelector('button')?.click());
	await act(async () => {
		await router?.navigate('/', { defaultShouldRevalidate: false });
	});
	await act(async () => reject(new TypeError('Failed to fetch')));
	expect(router?.state.location.pathname).toBe('/');
	expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('does not turn an HTTP error response into a connection failure', async () => {
	const { container } = await setup(async () => {
		throw new Response('Unavailable', { status: 503 });
	});
	await act(async () => container.querySelector('button')?.click());
	expect(router?.state.location.pathname).toBe('/next');
	expect(container.textContent).toContain('Page error');
});

it('recovers when the connection fails while reading the loader response', async () => {
	const { container } = await setup(async () => {
		throw new Error('Unable to decode turbo-stream response', {
			cause: new TypeError('network error'),
		});
	});
	await act(async () => container.querySelector('button')?.click());
	expect(router?.state.location.pathname).toBe('/');
	expect(container.querySelector('[role="alert"]')).not.toBeNull();
});
