/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React from 'react';
import { unmountComponentAtNode } from 'react-dom';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import * as Url from 'ts/url';

import { Link } from '.';

let container: HTMLDivElement | null = null;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
});

afterEach(() => {
	unmountComponentAtNode(container!);
	container?.remove();
	container = null;
});

describe('link', () => {
	describe('Link', () => {
		it('should overwrite href at all times', () => {
			act(() => {
				ReactDOM.render(
					<Link>
						<a className="target" href="https://badsite.com">
							hello!
						</a>
					</Link>,
					container
				);
			});

			const anchor: HTMLAnchorElement = container?.querySelector(
				'.target'
			) as any;
			expect(anchor).not.toBeUndefined();
			expect(anchor).toBeInstanceOf(HTMLAnchorElement);
			expect(anchor.href).toBe('');
		});
		it('should render a link', () => {
			act(() => {
				ReactDOM.render(
					<Link href={Url.URL.New`https://google.com`}>
						<a className="target">hello!</a>
					</Link>,
					container
				);
			});

			const anchor: HTMLAnchorElement = container?.querySelector(
				'.target'
			) as any;
			expect(anchor).not.toBeUndefined();
			expect(anchor).toBeInstanceOf(HTMLAnchorElement);
			expect(anchor.href).toBe('https://google.com/');
		});
	});
});
