import { type OrbitCamera, orbitPose } from '#root/ts/3d/low_poly.js';
import {
	buildFaceBSP,
	type FaceBSP,
	type FaceBSPSlot,
	visibleFaces,
	visitFaceBSP,
} from '#root/ts/math/face_bsp.js';
import {
	faceLayer,
	perspective,
	type RenderedFace2D,
	renderedSource,
	renderFaces,
	type StyledFace3D,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

interface PathEntry {
	node: SVGPathElement;
	path: string;
	fill: string;
}
interface PaintSlot {
	node: SVGGElement;
	paths: PathEntry[];
	count: number;
	frame: number;
	painted: boolean;
}

/** Keep static paint slots anchored while moving geometry changes inside the gaps. */
export function createSVGRenderer(svg: SVGSVGElement) {
	const namespace = 'http://www.w3.org/2000/svg';
	const group = document.createElementNS(namespace, 'g');
	group.setAttribute('class', 'park-scene');
	group.setAttribute('aria-hidden', 'true');
	group.setAttribute('stroke-width', '0.4');
	group.setAttribute('stroke-linejoin', 'round');
	svg.append(group);
	let world = new Map<number, FaceBSP | null>();
	let slots = new Map<object | number, Map<FaceBSPSlot, PaintSlot>>();
	const pool: PaintSlot[] = [];
	let used = 0,
		frame = 0;
	let previous: PaintSlot[] = [];
	let cameraKey = '';
	let viewBox = '';
	let projections = new WeakMap<StyledFace3D, RenderedFace2D | null>();

	function getSlot(key: object | number, kind: FaceBSPSlot): PaintSlot {
		let members = slots.get(key);
		if (!members) {
			members = new Map();
			slots.set(key, members);
		}
		let entry = members.get(kind);
		if (!entry) {
			entry = pool[used++];
			if (!entry) {
				entry = {
					node: document.createElementNS(namespace, 'g'),
					paths: [],
					count: 0,
					frame: 0,
					painted: false,
				};
				pool.push(entry);
			}
			entry.painted = false;
			members.set(kind, entry);
		}
		entry.frame = frame;
		return entry;
	}

	function paint(
		entry: PaintSlot,
		faces: readonly StyledFace3D[],
		rendered: ReadonlyMap<StyledFace3D, RenderedFace2D>
	) {
		// Adjacent fragments with the same paint can share one compound SVG path.
		// Never merge across another color: that would discard occlusion ordering.
		const runs: { path: string; fill: string }[] = [];
		for (const face of faces) {
			const projected = rendered.get(face);
			if (!projected) continue;
			projected((_source, path, fill) => {
				const previous = runs.at(-1);
				if (previous?.fill === fill) previous.path += path;
				else runs.push({ path, fill });
			});
		}
		for (let i = 0; i < runs.length; i++) {
			const face = runs[i]!;
			let path = entry.paths[i];
			if (!path) {
				path = {
					node: document.createElementNS(namespace, 'path'),
					path: '',
					fill: '',
				};
				entry.paths.push(path);
				entry.node.append(path.node);
			}
			if (path.path !== face.path) {
				path.node.setAttribute('d', face.path);
				path.path = face.path;
			}
			if (path.fill !== face.fill) {
				path.node.setAttribute('fill', face.fill);
				path.node.setAttribute('stroke', face.fill);
				path.fill = face.fill;
			}
			if (i >= entry.count) path.node.removeAttribute('display');
		}
		for (let i = runs.length; i < entry.count; i++)
			entry.paths[i]!.node.setAttribute('display', 'none');
		entry.count = runs.length;
		entry.painted = true;
	}

	return {
		setWorld(faces: readonly StyledFace3D[]) {
			world = new Map(
				[...byLayer(faces)].map(([layer, polygons]) => [
					layer,
					buildFaceBSP(polygons),
				])
			);
			slots = new Map();
			used = 0;
			cameraKey = '';
		},
		render(camera: OrbitCamera, faces: readonly StyledFace3D[]) {
			frame++;
			const width = Math.max(1, svg.clientWidth),
				height = Math.max(1, svg.clientHeight);
			const projection = perspective(width, height, { focalScale: 0.95 }),
				pose = orbitPose(camera);
			const key = JSON.stringify([camera, width, height]);
			if (key !== cameraKey) {
				// BSP planes are independent of the eye; orbiting only changes traversal
				// and projection. Keep their SVG slots and geometry alive across views.
				for (const entry of pool) entry.painted = false;
				projections = new WeakMap();
				cameraKey = key;
			}
			const bounds = `0 0 ${width} ${height}`;
			if (bounds !== viewBox) {
				svg.setAttribute('viewBox', bounds);
				viewBox = bounds;
			}
			const moving = byLayer(visibleFaces(faces, pose.position));
			const layers = [
				...new Set([...world.keys(), ...moving.keys()]),
			].sort((a, b) => a - b);
			const desired: PaintSlot[] = [],
				changed: {
					entry: PaintSlot;
					faces: readonly StyledFace3D[];
				}[] = [];
			for (const layer of layers)
				visitFaceBSP(
					world.get(layer) ?? null,
					pose.position,
					moving.get(layer) ?? [],
					(node, kind, polygons) => {
						const entry = getSlot(node ?? layer, kind);
						desired.push(entry);
						if (kind !== 'static' || !entry.painted)
							changed.push({ entry, faces: polygons });
					}
				);
			const rendered = unwrap(
				renderFaces(
					changed.flatMap(batch => batch.faces),
					pose,
					projection,
					{ preserveOrder: true, cache: projections }
				)
			);
			const bySource = new Map(
				rendered.map(face => [renderedSource(face), face])
			);
			for (const batch of changed)
				paint(batch.entry, batch.faces, bySource);
			for (const entry of previous)
				if (entry.frame !== frame) entry.node.remove();
			let next: Node | null = null;
			for (let i = desired.length - 1; i >= 0; i--) {
				const entry = desired[i]!;
				if (
					entry.node.parentNode !== group ||
					entry.node.nextSibling !== next
				)
					group.insertBefore(entry.node, next);
				next = entry.node;
			}
			previous = desired;
		},
		dispose() {
			group.remove();
			pool.length = 0;
			previous = [];
			world.clear();
			slots.clear();
			projections = new WeakMap();
		},
	};
}

function byLayer(faces: readonly StyledFace3D[]): Map<number, StyledFace3D[]> {
	const layers = new Map<number, StyledFace3D[]>();
	for (const face of faces) {
		const layer = faceLayer(face);
		let group = layers.get(layer);
		if (!group) {
			group = [];
			layers.set(layer, group);
		}
		group.push(face);
	}
	return layers;
}
