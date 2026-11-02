import { afterEach, beforeAll, expect, test } from '@jest/globals';
import { trackMouseHover } from './hover.js';
import { installTouchMouse } from './touch_mouse.js';

// jsdom does not yet expose the browser's PointerEvent constructor.
beforeAll(() => {
	if (typeof PointerEvent !== 'undefined') return;
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: class extends MouseEvent {
			readonly pointerType: string;
			constructor(type: string, options: PointerEventInit = {}) {
				super(type, options);
				this.pointerType = options.pointerType ?? '';
			}
		},
	});
});

afterEach(() => document.body.replaceChildren());

function setup() {
	const canvas = document.createElement('canvas');
	document.body.append(canvas);
	const controller = new AbortController();
	const hovering = trackMouseHover(canvas, controller.signal);
	installTouchMouse(canvas, controller.signal);
	const events: Array<{
		type: string;
		button: number;
		buttons: number;
		x: number;
	}> = [];
	for (const type of ['mousedown', 'mouseup', 'mousemove']) {
		canvas.addEventListener(type, event => {
			const mouse = event as MouseEvent;
			events.push({
				type,
				button: mouse.button,
				buttons: mouse.buttons,
				x: mouse.clientX,
			});
		});
	}
	const touch = (type: string, count: number, x = 100) => {
		const event = new TouchEvent(type, { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'targetTouches', {
			value: Array.from({ length: count }, (_, index) => ({
				clientX: x + index * 20,
				clientY: 50,
			})),
		});
		canvas.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	};
	const buttons = () =>
		events
			.filter(event => event.type !== 'mousemove')
			.map(event => [event.type, event.button, event.buttons]);
	return { canvas, controller, events, touch, buttons, hovering };
}

test('one finger still holds and drags the left mouse button', () => {
	const { touch, events, buttons, controller } = setup();
	touch('touchstart', 1);
	touch('touchmove', 1, 120);
	expect(events.at(-1)).toEqual({
		type: 'mousemove',
		button: 0,
		buttons: 1,
		x: 120,
	});
	touch('touchend', 0);
	expect(buttons()).toEqual([
		['mousedown', 0, 1],
		['mouseup', 0, 0],
	]);
	controller.abort();
});

test('two fingers hold right-click through movement and release when either lifts', () => {
	const { touch, events, buttons, controller } = setup();
	touch('touchstart', 1);
	touch('touchstart', 2);
	expect(buttons()).toEqual([
		['mousedown', 0, 1],
		['mouseup', 0, 0],
		['mousedown', 2, 2],
	]);
	touch('touchmove', 2, 150);
	touch('touchmove', 2, 160);
	expect(events.at(-1)).toEqual({
		type: 'mousemove',
		button: 0,
		buttons: 2,
		x: 160,
	});
	touch('touchend', 1);
	touch('touchmove', 1);
	touch('touchend', 0);
	expect(buttons().slice(3)).toEqual([['mouseup', 2, 0]]);
	touch('touchstart', 1);
	expect(buttons().at(-1)).toEqual(['mousedown', 0, 1]);
	controller.abort();
});

test.each(['touchcancel', 'blur', 'abort'])(
	'%s releases a held right button',
	kind => {
		const { touch, buttons, controller } = setup();
		touch('touchstart', 2);
		if (kind === 'touchcancel') touch(kind, 0);
		if (kind === 'blur') window.dispatchEvent(new Event('blur'));
		if (kind === 'abort') controller.abort();
		expect(buttons()).toEqual([
			['mousedown', 2, 2],
			['mouseup', 2, 0],
		]);
		controller.abort();
	}
);

test('SDL touch handlers cannot also synthesize a left click', () => {
	const { canvas, touch, controller } = setup();
	let nativeTouches = 0;
	canvas.addEventListener('touchstart', () => {
		nativeTouches++;
	});
	touch('touchstart', 2);
	expect(nativeTouches).toBe(0);
	controller.abort();
});

test('adding another finger does not repeat a right click, and two fingers can resume it', () => {
	const { touch, buttons, controller } = setup();
	touch('touchstart', 2);
	touch('touchstart', 3);
	touch('touchend', 2);
	expect(buttons()).toEqual([['mousedown', 2, 2]]);
	touch('touchend', 1);
	touch('touchstart', 2);
	touch('touchend', 0);
	expect(buttons()).toEqual([
		['mousedown', 2, 2],
		['mouseup', 2, 0],
		['mousedown', 2, 2],
		['mouseup', 2, 0],
	]);
	controller.abort();
});

test('SDL3 receives mouse Pointer Events without enabling hover scrolling', () => {
	const { canvas, touch, controller, hovering } = setup();
	const events: Array<[string, number, number]> = [];
	for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
		canvas.addEventListener(type, event => {
			const pointer = event as PointerEvent;
			expect(pointer.pointerType).toBe('mouse');
			events.push([type, pointer.button, pointer.buttons]);
		});
	}
	// The original touch pointers must not reach SDL3's bubble listeners.
	canvas.dispatchEvent(
		new PointerEvent('pointerdown', { pointerType: 'touch' })
	);
	touch('touchstart', 2);
	touch('touchmove', 2, 130);
	touch('touchend', 0);
	expect(events).toEqual([
		['pointermove', -1, 0],
		['pointerdown', 2, 2],
		['pointermove', -1, 2],
		['pointerup', 2, 0],
	]);
	expect(hovering()).toBe(false);
	controller.abort();
});
