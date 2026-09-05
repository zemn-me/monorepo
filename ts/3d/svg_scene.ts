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

/** Adjacent identical paints share a path without changing occlusion order. */
function paintRuns(
	faces: readonly StyledFace3D[],
	rendered: ReadonlyMap<StyledFace3D, RenderedFace2D>
): [path: string, fill: string][] {
	const runs: [path: string, fill: string][] = [];
	for (const face of faces) {
		const projected = rendered.get(face);
		if (!projected) continue;
		projected((_source, path, fill) => {
			const previous = runs.at(-1);
			if (previous?.[1] === fill) previous[0] += path;
			else runs.push([path, fill]);
		});
	}
	return runs;
}

/** Serialize an initial frame without a DOM; geometry and batching match live rendering. */
export function renderSVGSnapshot(
	worldFaces: readonly StyledFace3D[],
	faces: readonly StyledFace3D[],
	camera: OrbitCamera,
	width: number,
	height: number
): string {
	const world = new Map(
		[...byLayer(worldFaces)].map(([layer, polygons]) => [
			layer,
			buildFaceBSP(polygons),
		])
	);
	const pose = orbitPose(camera);
	const moving = byLayer(visibleFaces(faces, pose.position));
	const batches: (readonly StyledFace3D[])[] = [];
	for (const layer of [...new Set([...world.keys(), ...moving.keys()])].sort(
		(a, b) => a - b
	))
		visitFaceBSP(
			world.get(layer) ?? null,
			pose.position,
			moving.get(layer) ?? [],
			(_node, _kind, polygons) => batches.push(polygons)
		);
	const rendered = unwrap(
		renderFaces(
			batches.flat(),
			pose,
			perspective(width, height, { focalScale: 0.95 }),
			{ preserveOrder: true }
		)
	);
	const bySource = new Map(
		rendered.map(face => [renderedSource(face), face])
	);
	const attribute = (value: string) =>
		value
			.replaceAll('&', '&amp;')
			.replaceAll('"', '&quot;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;');
	return (
		'<g class="park-scene" aria-hidden="true" stroke-width="0.4" stroke-linejoin="round">' +
		batches
			.map(
				batch =>
					'<g>' +
					paintRuns(batch, bySource)
						.map(
							([path, fill]) =>
								`<path d="${attribute(path)}" fill="${attribute(fill)}" stroke="${attribute(fill)}"></path>`
						)
						.join('') +
					'</g>'
			)
			.join('') +
		'</g>'
	);
}

/** Keep static paint slots anchored while moving geometry changes inside the gaps. */
export function createSVGRenderer(svg: SVGSVGElement, host: SVGElement = svg) {
	const namespace = 'http://www.w3.org/2000/svg';
	const group =
		host.querySelector<SVGGElement>(':scope > g.park-scene') ??
		document.createElementNS(namespace, 'g');
	group.setAttribute('class', 'park-scene');
	group.setAttribute('aria-hidden', 'true');
	group.setAttribute('stroke-width', '0.4');
	group.setAttribute('stroke-linejoin', 'round');
	if (group.parentNode !== host) host.append(group);
	let world = new Map<number, FaceBSP | null>();
	let slots = new Map<object | number, Map<FaceBSPSlot, PaintSlot>>();
	// Reuse the server frame's nodes. The first live draw refreshes their contents
	// before any unused slots are removed, so startup never clears the visible park.
	const pool: PaintSlot[] = [
		...group.querySelectorAll<SVGGElement>(':scope > g'),
	].map(node => {
		const paths = [
			...node.querySelectorAll<SVGPathElement>(':scope > path'),
		].map(node => ({
			node,
			path: node.getAttribute('d') ?? '',
			fill: node.getAttribute('fill') ?? '',
		}));
		const count = paths.filter(
			path => path.node.getAttribute('display') !== 'none'
		).length;
		return { node, paths, count, frame: 0, painted: false };
	});
	let used = 0,
		frame = 0;
	let previous: PaintSlot[] = [...pool];
	let cameraKey = '';
	let viewBox = svg.getAttribute('viewBox') ?? '';
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
		const runs = paintRuns(faces, rendered);
		for (let i = 0; i < runs.length; i++) {
			const [pathData, fill] = runs[i]!;
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
			if (path.path !== pathData) {
				path.node.setAttribute('d', pathData);
				path.path = pathData;
			}
			if (path.fill !== fill) {
				path.node.setAttribute('fill', fill);
				path.node.setAttribute('stroke', fill);
				path.fill = fill;
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
		dispose(preserveFrame = false) {
			if (!preserveFrame) group.remove();
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
