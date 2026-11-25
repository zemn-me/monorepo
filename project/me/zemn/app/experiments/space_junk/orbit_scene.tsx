import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { createSVGRenderer } from '#root/ts/3d/svg_scene.js';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';
import type { globeFrame } from './globe_scene.js';

const emptyWorld: StyledFace3D[] = [];

export function OrbitScene({
	label,
	world = emptyWorld,
	faces,
	frame,
	children,
}: {
	label: string;
	world?: StyledFace3D[];
	faces: StyledFace3D[];
	frame: ReturnType<typeof globeFrame>;
	children?: ReactNode;
}) {
	const host = useRef<SVGGElement>(null);
	const renderer = useRef<ReturnType<typeof createSVGRenderer> | null>(null);
	useLayoutEffect(() => {
		const live = createSVGRenderer(
			host.current!.ownerSVGElement!,
			host.current!
		);
		renderer.current = live;
		return () => {
			live.dispose(true);
			renderer.current = null;
		};
	}, []);
	useLayoutEffect(() => {
		renderer.current!.setWorld(world);
	}, [world]);
	useLayoutEffect(() => {
		renderer.current!.render(frame.camera, faces, frame.projection);
	}, [world, faces, frame]);
	return (
		<g ref={host} aria-label={label}>
			{children}
		</g>
	);
}
