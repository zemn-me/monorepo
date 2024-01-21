import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { Article, Blurb, Main } from '#root/ts/react/article/blurb/index.js';

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

it('renders all content in long form', () => {
	act(() => {
		root.render(
			<Article>
				<Blurb>
					<div className="blurb">Hello, world!</div>
				</Blurb>
				<Main>
					<div className="main">main content goes here!</div>
				</Main>
			</Article>
		);
	});

	const blurb = container?.querySelector('.blurb');
	const main = container?.querySelector('.main');
	expect(blurb?.textContent).toEqual('Hello, world!');
	expect(main?.textContent).toEqual('main content goes here!');
});

it('renders blurb only in short form', () => {
	act(() => {
		root.render(
			<Article short>
				<Blurb>
					<div className="blurb">Hello, world!</div>
				</Blurb>
				<Main>
					<div className="main">main content goes here!</div>
				</Main>
			</Article>
		);
	});

	const blurb = container?.querySelector('.blurb');
	const main = container?.querySelector('.main');
	expect(blurb?.textContent).toEqual('Hello, world!');
	expect(main?.textContent).toBeUndefined();
});
