/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import * as Url from '#//ts/url';

import { Link } from '.';

let container: HTMLDivElement | null = null;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	root = createRoot(container!);
	document.body.appendChild(container);
});

afterEach(() => {
	root.unmount();
	container?.remove();
	container = null;
});

describe('link', () => {
	describe('Link', () => {
		it('should overwrite href at all times', () => {
			act(() => {
				root.render(
					<Link>
						<a className="target" href="https://badsite.com">
							hello!
						</a>
					</Link>
				);
			});

			const anchor: HTMLAnchorElement = container?.querySelector(
				'.target'
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			) as any;
			expect(anchor).not.toBeUndefined();
			expect(anchor).toBeInstanceOf(HTMLAnchorElement);
			expect(anchor.href).toBe('');
		});
		it('should render a link', () => {
			act(() => {
				root.render(
					<Link href={Url.URL.New`https://google.com`}>
						<a className="target">hello!</a>
					</Link>
				);
			});

			const anchor: HTMLAnchorElement = container?.querySelector(
				'.target'
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			) as any;
			expect(anchor).not.toBeUndefined();
			expect(anchor).toBeInstanceOf(HTMLAnchorElement);
			expect(anchor.href).toBe('https://google.com/');
		});
	});
});
