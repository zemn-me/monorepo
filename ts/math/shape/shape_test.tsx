/**
 * @jest-environment jsdom
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { Canvas } from '#root/ts/math/canvas/element.js';
import * as Shape from '#root/ts/math/shape/index.js';

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

describe('react.Canvas', () => {
	it('should append an svg element', () => {
		act(() => {
			root.render(<Canvas draw={new Shape.Square(1)} />);
		});

		expect(container?.querySelector('svg')).not.toBeUndefined();
	});
});
