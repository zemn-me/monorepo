'use client';

import { useEffect, useRef } from 'react';

import { createSVGWireframe } from '#root/ts/3d/svg_wireframe.js';
import { point } from '#root/ts/math/cartesian.js';
import { hangar } from '#root/ts/pulumi/waxingincandescent.com/app/hangar.js';

const radians = Math.PI / 180;

export function HangarBackground() {
	const ref = useRef<SVGSVGElement>(null);
	useEffect(() => {
		const svg = ref.current;
		if (!svg) return;
		return createSVGWireframe(
			svg,
			hangar()
		)((draw, dispose) => {
			const media = matchMedia('(prefers-reduced-motion: reduce)');
			const target = point<3>(0, 0, 0);
			let frame = 0;
			let previous = 0;
			let yaw = -48.7 * radians;
			const render = () => draw(yaw, 32 * radians, 62, target, 2.14, 0);
			const animate = (now: number) => {
				if (previous)
					yaw =
						(yaw +
							(Math.min(now - previous, 100) *
								2 *
								1.7 *
								radians) /
								1000) %
						(2 * Math.PI);
				previous = now;
				render();
				frame = requestAnimationFrame(animate);
			};
			const update = () => {
				cancelAnimationFrame(frame);
				previous = 0;
				render();
				if (!media.matches && !document.hidden)
					frame = requestAnimationFrame(animate);
			};
			const resize = new ResizeObserver(render);
			resize.observe(svg);
			media.addEventListener('change', update);
			document.addEventListener('visibilitychange', update);
			update();
			return () => {
				cancelAnimationFrame(frame);
				resize.disconnect();
				media.removeEventListener('change', update);
				document.removeEventListener('visibilitychange', update);
				dispose();
			};
		});
	}, []);
	return (
		<svg
			ref={ref}
			className="hangar-background"
			aria-hidden="true"
			focusable="false"
		/>
	);
}
