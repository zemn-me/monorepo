import {
	type ComponentPropsWithoutRef,
	type ReactNode,
	useEffect,
	useEffectEvent,
	useRef,
} from 'react';
import style from './style.module.css';

export function SlideRule({
	label,
	caption,
	children,
	readout,
	centre,
	min,
	max,
	pitch,
	tick,
	major,
	tickOrigin = 0,
	tickLabel,
	readPosition,
	seek,
	inputProps,
	onGrab,
	onRelease,
	afterWheel,
}: {
	label: string;
	caption?: string;
	children?: ReactNode;
	readout: string;
	centre: number;
	min: number;
	max: number;
	pitch: number;
	tick: number;
	major: number;
	tickOrigin?: number;
	tickLabel: (mark: number) => string;
	readPosition: () => number;
	seek: (mark: number) => void;
	inputProps: ComponentPropsWithoutRef<'input'>;
	onGrab?: (id: number) => void;
	onRelease?: (id: number) => void;
	afterWheel?: () => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	const track = useRef<HTMLDivElement>(null);
	const drag = useRef<{
		id: number;
		x: number;
		origin: number;
		moved: boolean;
		mark?: number;
	} | null>(null);
	const scroll = useEffectEvent((event: WheelEvent) => {
		if (event.ctrlKey || !event.cancelable) return;
		const delta =
			Math.abs(event.deltaX) > Math.abs(event.deltaY)
				? event.deltaX
				: event.deltaY;
		if (!delta) return;
		event.preventDefault();
		const pixels =
			event.deltaMode === WheelEvent.DOM_DELTA_LINE
				? 16
				: event.deltaMode === WheelEvent.DOM_DELTA_PAGE
					? track.current!.clientWidth
					: 1;
		seek(readPosition() + (delta * pixels) / pitch);
		afterWheel?.();
	});
	useEffect(() => {
		const strip = track.current!;
		strip.addEventListener('wheel', scroll, { passive: false });
		return () => strip.removeEventListener('wheel', scroll);
	}, []);

	const ticks = [];
	const radius = 430 / pitch;
	// An integer tick index avoids drift at twelfths of a year.
	const first = Math.ceil(
		(Math.max(min, centre - radius) - tickOrigin) / tick
	);
	const last = Math.floor(
		(Math.min(max, centre + radius) - tickOrigin) / tick
	);
	for (let i = first; i <= last; i++) {
		const mark = i * tick + tickOrigin;
		const labelled = i % Math.round(major / tick) === 0;
		ticks.push(
			<g
				key={i}
				transform={`translate(${(mark - centre) * pitch} 0)`}
				data-position={mark}
			>
				<path d={labelled ? 'M0 23v11' : 'M0 28v6'} />
				{labelled && (
					<>
						<rect
							x="-16"
							width="32"
							height="20"
							fill="transparent"
						/>
						<text y="17">{tickLabel(mark)}</text>
					</>
				)}
			</g>
		);
	}

	return (
		<div className={style.rulerRow}>
			<div className={style.rulerValue} aria-hidden="true">
				<span>{caption ?? label}</span>
				<strong>{readout}</strong>
			</div>
			<div
				ref={track}
				className={style.rulerTrack}
				onPointerDown={e => {
					if (!e.isPrimary || e.button !== 0) return;
					e.preventDefault();
					onGrab?.(e.pointerId);
					input.current?.focus({ preventScroll: true });
					const tick = (e.target as Element)
						.closest('g[data-position]')
						?.getAttribute('data-position');
					drag.current = {
						id: e.pointerId,
						x: e.clientX,
						origin: readPosition(),
						moved: false,
						mark: tick == null ? undefined : Number(tick),
					};
					e.currentTarget.setPointerCapture(e.pointerId);
				}}
				onPointerMove={e => {
					const start = drag.current;
					if (!start || start.id !== e.pointerId) return;
					const dx = e.clientX - start.x;
					const threshold = e.pointerType === 'touch' ? 3 : 0.5;
					if (!start.moved && Math.abs(dx) < threshold) return;
					start.moved = true;
					seek(start.origin - dx / pitch);
				}}
				onPointerUp={e => {
					const start = drag.current;
					if (!start || start.id !== e.pointerId) return;
					if (start.moved) {
						seek(start.origin - (e.clientX - start.x) / pitch);
					} else {
						const box = e.currentTarget.getBoundingClientRect();
						const offset = e.clientX - box.left - box.width / 2;
						seek(start.mark ?? start.origin + offset / pitch);
					}
				}}
				onLostPointerCapture={e => {
					if (drag.current?.id !== e.pointerId) return;
					drag.current = null;
					onRelease?.(e.pointerId);
				}}
			>
				<input
					type="range"
					ref={input}
					{...inputProps}
					aria-label={label}
				/>
				<svg aria-hidden="true" width="100%" height="44">
					<svg x="50%" width="1" height="44" overflow="visible">
						{ticks}
					</svg>
				</svg>
				<i aria-hidden="true" />
			</div>
			{children}
		</div>
	);
}
