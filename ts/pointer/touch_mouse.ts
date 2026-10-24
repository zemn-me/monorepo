// SDL's default touch mouse only represents the first finger. Translate the
// whole gesture so its synthetic left button cannot remain down during a right
// drag, and lifting one finger cannot accidentally start another left click.
export function installTouchMouse(
	canvas: HTMLCanvasElement,
	signal: AbortSignal
): void {
	let button: 0 | 2 | undefined;
	let position = { clientX: 0, clientY: 0 };
	let usedRightButton = false;
	const mouse = (type: string, changedButton: number, buttons: number) => {
		const options = {
			bubbles: true,
			cancelable: true,
			view: window,
			...position,
			button: changedButton,
			buttons,
		};
		// SDL3 consumes Pointer Events; SDL2 consumes legacy mouse events.
		canvas.dispatchEvent(
			new PointerEvent(type.replace('mouse', 'pointer'), {
				...options,
				pointerType: 'mouse',
				pointerId: 1,
				isPrimary: true,
				button: type === 'mousemove' ? -1 : changedButton,
			})
		);
		canvas.dispatchEvent(new MouseEvent(type, options));
	};
	const release = () => {
		if (button === undefined) return;
		const released = button;
		button = undefined;
		mouse('mouseup', released, 0);
	};
	const reset = () => {
		release();
		usedRightButton = false;
	};
	const touch = (event: TouchEvent) => {
		event.preventDefault();
		event.stopImmediatePropagation();
		const first = event.targetTouches[0];
		if (first)
			position = { clientX: first.clientX, clientY: first.clientY };
		if (event.type === 'touchcancel' || !first) {
			reset();
			return;
		}
		const next =
			event.targetTouches.length >= 2
				? 2
				: usedRightButton
					? undefined
					: 0;
		if (next !== button) release();
		mouse('mousemove', 0, button === 2 ? 2 : button === 0 ? 1 : 0);
		if (next !== undefined && button === undefined) {
			button = next;
			usedRightButton ||= next === 2;
			canvas.focus();
			mouse('mousedown', next, next === 2 ? 2 : 1);
		}
	};
	for (const type of [
		'touchstart',
		'touchmove',
		'touchend',
		'touchcancel',
	] as const) {
		canvas.addEventListener(type, touch, {
			capture: true,
			passive: false,
			signal,
		});
	}
	// SDL3 must not also receive the original finger input before the
	// TouchEvent translation. Hover tracking observes it first in capture.
	for (const type of [
		'pointerenter',
		'pointerleave',
		'pointerdown',
		'pointermove',
		'pointerup',
		'pointercancel',
	] as const) {
		canvas.addEventListener(
			type,
			event => {
				if (event.pointerType === 'touch')
					event.stopImmediatePropagation();
			},
			{ capture: true, signal }
		);
	}
	window.addEventListener('blur', reset, { signal });
	signal.addEventListener('abort', reset, { once: true });
}
