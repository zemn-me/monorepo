import {
	afterEach,
	beforeAll,
	beforeEach,
	expect,
	it,
	jest,
} from '@jest/globals';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { loading, resolve } from '#root/ts/future/future.js';

jest.unstable_mockModule(
	'#root/project/me/zemn/components/InlineLogin/inline_login.module.css',
	() => ({
		default: {
			indicator: 'indicator',
			inlineLogin: 'inlineLogin',
			loggedIn: 'loggedIn',
			loggedInText: 'loggedInText',
			profilePicture: 'profilePicture',
			sessionControl: 'sessionControl',
			sessionControls: 'sessionControls',
		},
	})
);

jest.unstable_mockModule(
	'#root/project/me/zemn/components/ProgressCircle/ProgressCircle.js',
	() => ({ ProgressCircle: () => <svg /> })
);

jest.unstable_mockModule(
	'#root/project/me/zemn/hook/usePosterDisplayName.js',
	() => ({ usePosterDisplayName: () => 'Test User' })
);

const logOut = jest.fn();
const switchUser = jest.fn(async () => undefined);
let isLoggedIn = true;

const claims = {
	aud: 'client',
	exp: 4_102_444_800,
	family_name: 'User',
	given_name: 'Test',
	iat: 1_700_000_000,
	iss: 'https://accounts.example.com',
	sub: 'test-user',
};
const idToken = `header.${btoa(JSON.stringify(claims))}.signature`;

jest.unstable_mockModule('#root/project/me/zemn/hook/useZemnMeAuth.js', () => ({
	useZemnMeAuth: () => [
		isLoggedIn ? resolve(idToken) : loading(undefined),
		loading(undefined),
		resolve(async () => undefined),
		logOut,
		resolve(switchUser),
	],
}));

let InlineLogin: () => JSX.Element;
let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
	InlineLogin = (await import('./inline_login.js')).InlineLogin;
});

beforeEach(() => {
	isLoggedIn = true;
	logOut.mockClear();
	switchUser.mockClear();
	container = document.createElement('div');
	root = createRoot(container);
	document.body.appendChild(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

it('offers compact accessible logout and switch-user controls', () => {
	act(() => root.render(<InlineLogin />));

	const logOutButton = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Log out"]'
	);
	const switchUserButton = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Switch user"]'
	);

	expect(logOutButton?.title).toBe('Log out');
	expect(switchUserButton?.title).toBe('Switch user');
	expect(logOutButton?.textContent).toBe('');
	expect(switchUserButton?.textContent).toBe('');

	act(() => logOutButton?.click());
	act(() => switchUserButton?.click());
	expect(logOut).toHaveBeenCalledTimes(1);
	expect(switchUser).toHaveBeenCalledTimes(1);
});

it('does not show session controls while logged out', () => {
	isLoggedIn = false;
	act(() => root.render(<InlineLogin />));

	expect(container.querySelector('button[aria-label="Log out"]')).toBeNull();
	expect(
		container.querySelector('button[aria-label="Switch user"]')
	).toBeNull();
	expect(container.querySelector('button')?.textContent).toBe('Log in');
});
