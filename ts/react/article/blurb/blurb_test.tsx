import React from 'react';
import { unmountComponentAtNode } from 'react-dom';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import { Article, Blurb, Main } from '.';

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

it('renders all content in long form', () => {
	act(() => {
		ReactDOM.render(
			<Article>
				<Blurb>
					<div className="blurb">Hello, world!</div>
				</Blurb>
				<Main>
					<div className="main">main content goes here!</div>
				</Main>
			</Article>,
			container
		);
	});

	const blurb = container?.querySelector('.blurb');
	const main = container?.querySelector('.main');
	expect(blurb?.textContent).toEqual('Hello, world!');
	expect(main?.textContent).toEqual('main content goes here!');
});

it('renders blurb only in short form', () => {
	act(() => {
		ReactDOM.render(
			<Article short>
				<Blurb>
					<div className="blurb">Hello, world!</div>
				</Blurb>
				<Main>
					<div className="main">main content goes here!</div>
				</Main>
			</Article>,
			container
		);
	});

	const blurb = container?.querySelector('.blurb');
	const main = container?.querySelector('.main');
	expect(blurb?.textContent).toEqual('Hello, world!');
	expect(main?.textContent).toBeUndefined();
});
