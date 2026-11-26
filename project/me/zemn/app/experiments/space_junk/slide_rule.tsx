import {
	type ComponentPropsWithoutRef,
	type ReactNode,
	useId,
	useLayoutEffect,
	useState,
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
	bands,
	marks,
	tickLabel,
	readPosition,
	seek,
	inputProps,
	onGrab,
	onRelease,
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
	marks?: readonly { position: number; glyph: string; label: string }[];
	bands?: readonly {
		start: number;
		split: number;
		end: number;
		startLabel: string;
		endLabel: string;
	}[];
	tickLabel: (mark: number) => string;
	readPosition: () => number;
	seek: (mark: number) => void;
	inputProps: ComponentPropsWithoutRef<'input'>;
	onGrab?: (id: number) => void;
	onRelease?: (id: number) => void;
}) {
	const hatchId = useId();
	const input = useRef<HTMLInputElement>(null);
	const drag = useRef<{
		id: number;
		x: number;
		origin: number;
		moved: boolean;
		mark?: number;
	} | null>(null);

	const fullScale = marks !== undefined;
	const track = useRef<HTMLDivElement>(null);
	const [trackWidth, setTrackWidth] = useState(0);
	useLayoutEffect(() => {
		const el = track.current;
		if (!el || !fullScale) return;
		const measure = () => setTrackWidth(el.clientWidth);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [fullScale]);

	// Keep distant planets visible on the zoom scale even at Earth-scale zoom.
	const inset = 10;
	const pixelsPerUnit = fullScale
		? Math.max(1, trackWidth - 2 * inset) / (max - min)
		: pitch;
	const at = (value: number) =>
		fullScale
			? inset + (value - min) * pixelsPerUnit
			: (value - centre) * pitch;
	const pointerValue = (x: number) =>
		min +
		(x - track.current!.getBoundingClientRect().left - inset) /
			pixelsPerUnit;
	const labelStep = fullScale
		? major * Math.max(1, Math.ceil(70 / (major * pixelsPerUnit)))
		: major;

	const ticks = [];
	const radius = 430 / pitch;
	// An integer tick index avoids drift at twelfths of a year.
	const first = Math.ceil(
		((fullScale ? min : Math.max(min, centre - radius)) - tickOrigin) / tick
	);
	const last = Math.floor(
		((fullScale ? max : Math.min(max, centre + radius)) - tickOrigin) / tick
	);
	for (let i = first; i <= last; i++) {
		const mark = i * tick + tickOrigin;
		const majorTick = i % Math.round(labelStep / tick) === 0;
		const labelled = fullScale
			? mark === max || (majorTick && at(max) - at(mark) >= 70)
			: majorTick;
		ticks.push(
			<g
				key={i}
				transform={`translate(${at(mark)} 0)`}
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
						<text
							y="17"
							style={
								fullScale
									? {
											textAnchor:
												mark === min
													? 'start'
													: mark === max
														? 'end'
														: 'middle',
										}
									: undefined
							}
						>
							{tickLabel(mark)}
						</text>
					</>
				)}
			</g>
		);
	}

	const height = marks?.length ? 62 : 44;
	let lastLabel = -Infinity;
	const annotations = marks
		?.toSorted((a, b) => a.position - b.position)
		.map((mark, i, all) => {
			const x = at(mark.position);
			const gap = Math.min(
				18,
				(trackWidth - 2 * inset) / Math.max(1, all.length - 1)
			);
			const labelX = Math.min(
				trackWidth - inset - (all.length - 1 - i) * gap,
				Math.max(x, lastLabel + gap)
			);
			lastLabel = labelX;
			return (
				<g
					key={mark.glyph}
					className={style.rulerMark}
					data-position={mark.position}
				>
					<title>{mark.label}</title>
					<path d={`M${x} 34v3L${labelX} 44`} fill="none" />
					<text x={labelX} y="57">
						{mark.glyph}
						{'\uFE0E'}
					</text>
				</g>
			);
		});

	return (
		<div className={style.rulerRow}>
			<div className={style.rulerValue} aria-hidden="true">
				<span>{caption ?? label}</span>
				<strong>{readout}</strong>
			</div>
			<div
				ref={track}
				className={style.rulerTrack}
				data-full-scale={fullScale || undefined}
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
					seek(
						fullScale
							? pointerValue(e.clientX)
							: start.origin - dx / pitch
					);
				}}
				onPointerUp={e => {
					const start = drag.current;
					if (!start || start.id !== e.pointerId) return;
					if (start.moved) {
						seek(
							fullScale
								? pointerValue(e.clientX)
								: start.origin - (e.clientX - start.x) / pitch
						);
					} else {
						const box = e.currentTarget.getBoundingClientRect();
						const offset = e.clientX - box.left - box.width / 2;
						seek(
							start.mark ??
								(fullScale
									? pointerValue(e.clientX)
									: start.origin + offset / pitch)
						);
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
				<svg aria-hidden="true" width="100%" height={height}>
					{bands && (
						<defs>
							<pattern
								id={hatchId}
								patternUnits="userSpaceOnUse"
								width="6"
								height="6"
								patternTransform="rotate(35)"
							>
								<path d="M3 0v6" />
							</pattern>
						</defs>
					)}
					<svg
						x={fullScale ? 0 : '50%'}
						width="1"
						height={height}
						overflow="visible"
					>
						{bands?.map(
							({ start, split, end, startLabel, endLabel }) => {
								const span = (end - start) * pitch;
								const divider = (split - start) * pitch;
								return (
									<g
										key={start}
										className={style.rulerBand}
										transform={`translate(${(start - centre) * pitch} 0)`}
										pointerEvents="none"
									>
										<rect
											y="21"
											width={span}
											height="12"
											fill="currentColor"
											opacity=".08"
										/>
										<g fill={`url(#${hatchId})`}>
											<rect
												y="21"
												width={divider}
												height="12"
											/>
											<rect
												y="21"
												width={span - divider}
												height="12"
												transform={`translate(${span} 0) scale(-1 1)`}
											/>
										</g>
										<path
											d={`M0 21v12h${span}V21 M${divider} 21v12`}
											fill="none"
										/>
										<text y="43">{startLabel}</text>
										<text x={span} y="43">
											{endLabel}
										</text>
									</g>
								);
							}
						)}
						{ticks}
						{annotations}
					</svg>
				</svg>
				<i
					aria-hidden="true"
					style={fullScale ? { left: at(centre) } : undefined}
				/>
			</div>
			{children}
		</div>
	);
}
