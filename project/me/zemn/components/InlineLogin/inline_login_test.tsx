import {
	afterEach,
	beforeAll,
	beforeEach,
	expect,
	it,
	jest,
} from '@jest/globals';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

jest.unstable_mockModule('./inline_login.module.css', () => ({
	default: {
		accountAction: 'accountAction',
		accountActions: 'accountActions',
		indicator: 'indicator',
		loggedIn: 'loggedIn',
		loggedInText: 'loggedInText',
		profilePicture: 'profilePicture',
	},
}));

jest.unstable_mockModule(
	'#root/project/me/zemn/components/ProgressCircle/ProgressCircle.js',
	() => ({ ProgressCircle: () => null })
);
jest.unstable_mockModule(
	'#root/project/me/zemn/hook/usePosterDisplayName.js',
	() => ({ usePosterDisplayName: () => 'Test User' })
);

const logout = jest.fn<() => void>();
const switchUser = jest.fn<() => Promise<void>>(() => Promise.resolve());
const claims = {
	aud: 'client-id',
	exp: Math.floor(Date.now() / 1000) + 3600,
	iat: Math.floor(Date.now() / 1000),
	iss: 'https://issuer.example',
	sub: 'test-user',
};
const token = `header.${btoa(JSON.stringify(claims))}.signature`;

jest.unstable_mockModule('#root/project/me/zemn/hook/useZemnMeAuth.js', () => ({
	useZemnMeAuth: () => [
		(onResolved: (value: string) => unknown) => onResolved(token),
		undefined,
		(
			_onResolved: (value: () => Promise<void>) => unknown,
			onPending: () => unknown
		) => onPending(),
		{ logout, switchUser },
	],
}));

let InlineLogin: () => JSX.Element;
let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
	InlineLogin = (await import('./inline_login.js')).InlineLogin;
});

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => root.render(<InlineLogin />));
});

afterEach(() => {
	root.unmount();
	container.remove();
	logout.mockClear();
	switchUser.mockClear();
});

it('renders compact accessible logout and switch-user controls', () => {
	const logoutButton = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Log out"]'
	);
	const switchButton = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Switch user"]'
	);

	expect(logoutButton?.title).toBe('Log out');
	expect(logoutButton?.textContent).toBe('');
	expect(switchButton?.title).toBe('Switch user');
	expect(switchButton?.textContent).toBe('');

	act(() => logoutButton?.click());
	act(() => switchButton?.click());

	expect(logout).toHaveBeenCalledTimes(1);
	expect(switchUser).toHaveBeenCalledTimes(1);
});
