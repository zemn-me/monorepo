import { type OrbitCamera, orbitPose } from '#root/ts/3d/low_poly.js';
import {
	buildFaceBSP,
	type FaceBSP,
	orderFaceBSP,
	visibleFaces,
} from '#root/ts/math/face_bsp.js';
import {
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
	let world = new Map<number, FaceBSP | null>();
	let worldFaces: readonly StyledFace3D[] = [];
	let cameraKey = '';
	let projections = new WeakMap<StyledFace3D, RenderedFace2D | null>();
	let visibleCount = 0;
	return {
		setWorld(faces: readonly StyledFace3D[]) {
			worldFaces = faces;
			cameraKey = '';
		},
		render(camera: OrbitCamera, faces: readonly StyledFace3D[]) {
			const width = Math.max(1, svg.clientWidth),
				height = Math.max(1, svg.clientHeight);
			const projection = perspective(width, height, { focalScale: 0.95 });
			const pose = orbitPose(camera);
			svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
			const key = JSON.stringify([camera, width, height]);
			if (key !== cameraKey) {
				world = new Map(
					[...byLayer(visibleFaces(worldFaces, pose.position))].map(
						([layer, group]) => [layer, buildFaceBSP(group)]
					)
				);
				projections = new WeakMap();
				cameraKey = key;
			}
			const moving = byLayer(visibleFaces(faces, pose.position));
			const layers = [
				...new Set([...world.keys(), ...moving.keys()]),
			].sort((a, b) => a - b);
			const ordered = layers.flatMap(layer =>
				orderFaceBSP(
					world.get(layer) ?? null,
					pose.position,
					moving.get(layer) ?? []
				)
			);
			const rendered = unwrap(
				renderFaces(ordered, pose, projection, {
					preserveOrder: true,
					cache: projections,
				})
			);
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
			world.clear();
			worldFaces = [];
			projections = new WeakMap();
		},
	};
}

function byLayer(faces: readonly StyledFace3D[]): Map<number, StyledFace3D[]> {
	const layers = new Map<number, StyledFace3D[]>();
	for (const face of faces) {
		const layer = face.layer ?? 0;
		let group = layers.get(layer);
		if (!group) {
			group = [];
			layers.set(layer, group);
		}
		group.push(face);
	}
	return layers;
}
