import { type OrbitCamera, orbitPose } from '#root/ts/3d/low_poly.js';
import {
	perspective,
	renderSegments,
	type StyledSegment3D,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

/** Project a static wire model through the shared camera into pooled SVG paths. */
export function createSVGWireframe(
	svg: SVGSVGElement,
	segments: readonly StyledSegment3D[]
) {
	const namespace = 'http://www.w3.org/2000/svg';
	const group = document.createElementNS(namespace, 'g');
	group.setAttribute('fill', 'none');
	group.setAttribute('stroke-linecap', 'round');
	svg.append(group);
	const paths = new Map<string, SVGPathElement>();
	return {
		render(camera: OrbitCamera, zoom = 1) {
			const width = Math.max(1, svg.clientWidth);
			const height = Math.max(1, svg.clientHeight);
			svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
			const projected = unwrap(
				renderSegments(
					segments,
					orbitPose(camera),
					perspective(width, height, {
						focalScale: 0.95 * zoom,
						farPlane: camera.distance + 150,
					})
				)
			);
			const batches = new Map<string, string>();
			for (const line of projected) {
				// A small depth palette keeps the DOM bounded as the camera orbits.
				const opacity = Math.round(line.opacity * 8) / 8;
				const key = JSON.stringify([line.stroke, line.width, opacity]);
				let path = paths.get(key);
				if (!path) {
					path = document.createElementNS(namespace, 'path');
					path.setAttribute('stroke', line.stroke);
					path.setAttribute('stroke-width', String(line.width));
					path.setAttribute('opacity', String(opacity));
					paths.set(key, path);
					group.append(path);
				}
				const d = `M${line.x1.toFixed(2)} ${line.y1.toFixed(2)}L${line.x2.toFixed(2)} ${line.y2.toFixed(2)}`;
				batches.set(key, (batches.get(key) ?? '') + d);
			}
			for (const [key, path] of paths)
				path.setAttribute('d', batches.get(key) ?? '');
		},
		dispose() {
			group.remove();
			paths.clear();
		},
	};
}
