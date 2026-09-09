'use client';

import { useEffect, useRef, useState } from 'react';

import { createSVGWireframe } from '#root/ts/3d/svg_wireframe.js';
import { hangar } from '#root/ts/pulumi/waxingincandescent.com/app/hangar.js';

export function HangarBackground() {
	const ref = useRef<SVGSVGElement>(null);
	const [paused, setPaused] = useState(false);
	const [reducedMotion, setReducedMotion] = useState(false);
	const yaw = useRef(-0.85);

	useEffect(() => {
		const media = matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => setReducedMotion(media.matches);
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	}, []);

	useEffect(() => {
		const svg = ref.current;
		if (!svg) return;
		const renderer = createSVGWireframe(svg, hangar());
		let frame = 0;
		let previous = 0;
		const render = () =>
			renderer.render(
				{
					yaw: yaw.current,
					pitch: 0.85,
					distance: 62,
					target: [0, 0, 0],
				},
				3.92
			);
		const animate = (now: number) => {
			if (previous)
				yaw.current +=
					(Math.min(now - previous, 100) * Math.PI * 2 * 1.69) /
					180_000;
			previous = now;
			render();
			frame = requestAnimationFrame(animate);
		};
		const update = () => {
			cancelAnimationFrame(frame);
			previous = 0;
			render();
			if (
				!paused &&
				!matchMedia('(prefers-reduced-motion: reduce)').matches &&
				!document.hidden
			)
				frame = requestAnimationFrame(animate);
		};
		const resize = new ResizeObserver(render);
		resize.observe(svg);
		document.addEventListener('visibilitychange', update);
		update();
		return () => {
			cancelAnimationFrame(frame);
			resize.disconnect();
			document.removeEventListener('visibilitychange', update);
			renderer.dispose();
		};
	}, [paused, reducedMotion]);

	return (
		<>
			<svg
				ref={ref}
				className="hangar-background"
				aria-hidden="true"
				focusable="false"
			/>
			{!reducedMotion && (
				<button
					className="motion-toggle"
					type="button"
					aria-label={
						paused
							? 'Resume level rotation'
							: 'Pause level rotation'
					}
					onClick={() => setPaused(value => !value)}
				>
					{paused ? 'Resume motion' : 'Pause motion'}
				</button>
			)}
		</>
	);
}
