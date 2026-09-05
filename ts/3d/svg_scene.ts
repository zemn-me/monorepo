import { type OrbitCamera, orbitPose } from '#root/ts/3d/low_poly.js';
import {
	compareRenderedFaces,
	perspective,
	type RenderedFace2D,
	renderFaces,
	type StyledFace3D,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

/** Mount the shared face renderer into SVG, reusing paths between animation frames. */
export function createSVGRenderer(svg: SVGSVGElement) {
	const namespace = 'http://www.w3.org/2000/svg';
	const group = document.createElementNS(namespace, 'g');
	group.setAttribute('class', 'park-scene');
	group.setAttribute('aria-hidden', 'true');
	group.setAttribute('stroke-width', '0.4');
	group.setAttribute('stroke-linejoin', 'round');
	svg.append(group);
	const paths: { node: SVGPathElement; path: string; fill: string }[] = [];
	let world: readonly StyledFace3D[] = [];
	let projectedWorld: RenderedFace2D[] = [];
	let previousCamera = '';
	let visibleCount = 0;
	return {
		setWorld(faces: readonly StyledFace3D[]) {
			world = faces;
			previousCamera = '';
		},
		render(camera: OrbitCamera, faces: readonly StyledFace3D[]) {
			const width = Math.max(1, svg.clientWidth),
				height = Math.max(1, svg.clientHeight);
			const projection = perspective(width, height, { focalScale: 0.95 });
			const pose = orbitPose(camera);
			const key = JSON.stringify([camera, width, height]);
			if (key !== previousCamera) {
				projectedWorld = unwrap(renderFaces(world, pose, projection));
				previousCamera = key;
				svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
			}
			const rendered = [
				...projectedWorld,
				...unwrap(renderFaces(faces, pose, projection)),
			].sort(compareRenderedFaces);
			for (let i = 0; i < rendered.length; i++) {
				const face = rendered[i]!;
				let entry = paths[i];
				if (!entry) {
					const node = document.createElementNS(namespace, 'path');
					group.append(node);
					entry = { node, path: '', fill: '' };
					paths.push(entry);
				}
				if (entry.path !== face.path) {
					entry.node.setAttribute('d', face.path);
					entry.path = face.path;
				}
				if (entry.fill !== face.fill) {
					entry.node.setAttribute('fill', face.fill);
					entry.node.setAttribute('stroke', face.fill);
					entry.fill = face.fill;
				}
				if (i >= visibleCount) entry.node.removeAttribute('display');
			}
			for (let i = rendered.length; i < visibleCount; i++)
				paths[i]!.node.setAttribute('display', 'none');
			visibleCount = rendered.length;
		},
		dispose() {
			group.remove();
			paths.length = 0;
			world = [];
			projectedWorld = [];
		},
	};
}
