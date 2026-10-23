// Touch contacts can leave a synthetic mouse position behind after release.
// Only a hovering mouse should drive actions that continue without a button.
export function trackMouseHover(
	canvas: HTMLCanvasElement,
	signal: AbortSignal
): () => boolean {
	let hovering = false;
	const track = (event: PointerEvent) => {
		hovering = event.pointerType === 'mouse';
	};
	const clear = () => {
		hovering = false;
	};
	for (const type of ['pointerenter', 'pointermove', 'pointerdown'] as const) {
		canvas.addEventListener(type, track, { signal });
	}
	canvas.addEventListener('pointerleave', clear, { signal });
	window.addEventListener('blur', clear, { signal });
	return () => hovering;
}
