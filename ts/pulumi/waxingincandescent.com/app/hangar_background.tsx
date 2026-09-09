'use client';

import { useEffect, useRef, useState } from 'react';

import { createSVGWireframe } from '#root/ts/3d/svg_wireframe.js';
import { hangar } from '#root/ts/pulumi/waxingincandescent.com/app/hangar.js';

const radians = Math.PI / 180;
const sliders = [
	{ key: 'yaw', label: 'Yaw', min: -180, max: 180, unit: '°' },
	{ key: 'tilt', label: 'Tilt', min: -90, max: 90, unit: '°' },
	{ key: 'roll', label: 'Roll', min: -180, max: 180, unit: '°' },
	{ key: 'zoom', label: 'Zoom', min: 0.25, max: 8, unit: '×' },
	{ key: 'speed', label: 'Speed', min: 0, max: 5, unit: '×' },
] as const;

export function HangarBackground() {
	const ref = useRef<SVGSVGElement>(null);
	const [paused, setPaused] = useState(false);
	const [reducedMotion, setReducedMotion] = useState(false);
	const [controls, setControls] = useState({
		yaw: -48.7,
		tilt: 48.7,
		roll: 0,
		zoom: 3.92,
		speed: 1.69,
	});
	const settings = useRef(controls);
	const stopped = useRef(false);
	const adjusting = useRef(false);
	const refresh = useRef<(() => void) | null>(null);

	useEffect(() => {
		const svg = ref.current;
		if (!svg) return;
		const renderer = createSVGWireframe(svg, hangar());
		const media = matchMedia('(prefers-reduced-motion: reduce)');
		let frame = 0;
		let previous = 0;
		let lastReadout = 0;
		const render = () =>
			renderer.render(
				{
					yaw: settings.current.yaw * radians,
					pitch: settings.current.tilt * radians,
					distance: 62,
					target: [0, 0, 0],
				},
				settings.current.zoom,
				settings.current.roll * radians
			);
		const animate = (now: number) => {
			if (previous) {
				const yaw =
					settings.current.yaw +
					(Math.min(now - previous, 100) *
						2 *
						settings.current.speed) /
						1000;
				settings.current = {
					...settings.current,
					yaw: ((yaw + 180) % 360) - 180,
				};
			}
			previous = now;
			render();
			// Keep the control readout current without re-rendering React every frame.
			if (now - lastReadout >= 100) {
				setControls(settings.current);
				lastReadout = now;
			}
			frame = requestAnimationFrame(animate);
		};
		const update = () => {
			cancelAnimationFrame(frame);
			previous = 0;
			render();
			if (
				!stopped.current &&
				!adjusting.current &&
				!media.matches &&
				!document.hidden &&
				settings.current.speed > 0
			)
				frame = requestAnimationFrame(animate);
		};
		const updateMotion = () => {
			setReducedMotion(media.matches);
			update();
		};
		refresh.current = update;
		const resize = new ResizeObserver(render);
		resize.observe(svg);
		media.addEventListener('change', updateMotion);
		document.addEventListener('visibilitychange', update);
		updateMotion();
		return () => {
			cancelAnimationFrame(frame);
			refresh.current = null;
			resize.disconnect();
			media.removeEventListener('change', updateMotion);
			document.removeEventListener('visibilitychange', update);
			renderer.dispose();
		};
	}, []);

	function change(key: keyof typeof controls, value: number) {
		settings.current = { ...settings.current, [key]: value };
		setControls(settings.current);
		refresh.current?.();
	}
	function setAdjusting(value: boolean) {
		adjusting.current = value;
		if (value) setControls(settings.current);
		refresh.current?.();
	}

	return (
		<>
			<svg
				ref={ref}
				className="hangar-background"
				aria-hidden="true"
				focusable="false"
			/>
			<section className="camera-controls" aria-label="Camera controls">
				<div className="camera-controls-header">
					<span>Camera</span>
					{!reducedMotion && (
						<button
							className="motion-toggle"
							type="button"
							aria-label={
								paused
									? 'Resume level rotation'
									: 'Pause level rotation'
							}
							onClick={() => {
								stopped.current = !stopped.current;
								setPaused(stopped.current);
								setControls(settings.current);
								refresh.current?.();
							}}
						>
							{paused ? 'Resume motion' : 'Pause motion'}
						</button>
					)}
				</div>
				{sliders.map(({ key, label, min, max, unit }) => (
					<div className="camera-control" key={key}>
						<label htmlFor={`camera-${key}`}>{label}</label>
						<input
							id={`camera-${key}`}
							type="range"
							min={min}
							max={max}
							step={0.01}
							value={controls[key]}
							aria-valuetext={`${controls[key].toFixed(unit === '×' ? 2 : 1)}${unit === '°' ? ' degrees' : ' times'}`}
							onChange={event =>
								change(key, event.currentTarget.valueAsNumber)
							}
							onPointerDown={event => {
								event.currentTarget.setPointerCapture(
									event.pointerId
								);
								setAdjusting(true);
							}}
							onPointerUp={() => setAdjusting(false)}
							onPointerCancel={() => setAdjusting(false)}
							onKeyDown={() => setAdjusting(true)}
							onKeyUp={() => setAdjusting(false)}
							onBlur={() => setAdjusting(false)}
						/>
						<span className="camera-value" aria-hidden="true">
							{controls[key].toFixed(unit === '×' ? 2 : 1)}
							{unit}
						</span>
					</div>
				))}
			</section>
		</>
	);
}
