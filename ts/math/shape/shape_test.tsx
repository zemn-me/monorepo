/**
 * @jest-environment jsdom
 */

import React from 'react';
import { unmountComponentAtNode } from 'react-dom';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { Canvas } from 'ts/math/canvas/element';
import * as Shape from 'ts/math/shape';

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

describe('react.Canvas', () => {
	it('should append an svg element', () => {
		act(() => {
			ReactDOM.render(<Canvas draw={new Shape.Square(1)} />, container);
		});

		expect(container?.querySelector('svg')).not.toBeUndefined();
	});
});
