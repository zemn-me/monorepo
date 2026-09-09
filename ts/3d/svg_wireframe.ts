import { orbitPosition } from '#root/ts/3d/low_poly.js';
import { cameraSpaceTransform } from '#root/ts/math/camera_pose.js';
import { type Point3D } from '#root/ts/math/cartesian.js';
import {
	cameraProjector,
	projectSegments,
	type WireSegment3D,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

type RenderWireframe = (
	yaw: number,
	pitch: number,
	distance: number,
	target: Point3D,
	zoom?: number,
	roll?: number
) => void;
export type SVGWireframe = <R>(
	use: (render: RenderWireframe, dispose: () => void) => R
) => R;

/** Church-encoded lifecycle and segments keep application fields out of runtime keys. */
export function createSVGWireframe(
	svg: SVGSVGElement,
	segments: readonly WireSegment3D[]
): SVGWireframe {
	const namespace = 'http://www.w3.org/2000/svg';
	const group = document.createElementNS(namespace, 'g');
	group.setAttribute('fill', 'none');
	group.setAttribute('stroke-linecap', 'round');
	svg.append(group);
	const paths = new Map<string, SVGPathElement>();
	const render: RenderWireframe = (
		yaw,
		pitch,
		distance,
		target,
		zoom = 1,
		roll = 0
	) => {
		const width = Math.max(1, svg.clientWidth),
			height = Math.max(1, svg.clientHeight);
		svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
		// Camera roll is a rotation around the projected optical centre.
		group.setAttribute(
			'transform',
			`rotate(${(roll * 180) / Math.PI} ${width / 2} ${height / 2})`
		);
		const projected = projectSegments(
			segments,
			unwrap(
				cameraSpaceTransform(
					orbitPosition(yaw, pitch, distance, target),
					yaw + Math.PI,
					pitch
				)
			),
			cameraProjector(width, height, 0.95 * zoom),
			0.1,
			distance + 150
		);
		const batches = new Map<string, string>();
		for (const line of projected)
			line((x1, y1, x2, y2, stroke, width, alpha) => {
				// A small depth palette keeps the DOM bounded as the camera orbits.
				const opacity = Math.round(alpha * 8) / 8;
				const key = JSON.stringify([stroke, width, opacity]);
				let path = paths.get(key);
				if (!path) {
					path = document.createElementNS(namespace, 'path');
					path.setAttribute('stroke', stroke);
					path.setAttribute('stroke-width', String(width));
					path.setAttribute('opacity', String(opacity));
					paths.set(key, path);
					group.append(path);
				}
				const d = `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
				batches.set(key, (batches.get(key) ?? '') + d);
			});
		for (const [key, path] of paths)
			path.setAttribute('d', batches.get(key) ?? '');
	};
	return use =>
		use(render, () => {
			group.remove();
			paths.clear();
		});
}
