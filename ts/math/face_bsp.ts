import { type Point3D, point, x, y, z } from '#root/ts/math/cartesian.js';
import {
	faceDoubleSided,
	faceVertices,
	type StyledFace3D,
	styledFace,
} from '#root/ts/math/wireframe_render.js';

// Faces and their vertices are immutable; cached planes can be shared across frames.
// World-space tolerance keeps coplanar faces stable as the camera moves.
const epsilon = 1e-7;
type Plane = readonly [number, number, number, number];
/** Immutable tree node; continuations expose fields without a property-name ABI. */
export type FaceBSP = <R>(
	use: (
		plane: Plane,
		faces: readonly StyledFace3D[],
		front: FaceBSP | null,
		back: FaceBSP | null
	) => R
) => R;

function distance(p: Point3D, plane: Plane): number {
	return x(p) * plane[0] + y(p) * plane[1] + z(p) * plane[2] - plane[3];
}

const planeCache = new WeakMap<StyledFace3D, Plane | null>();

function facePlane(face: StyledFace3D): Plane | null {
	if (planeCache.has(face)) return planeCache.get(face)!;
	const plane = computePlane(face);
	planeCache.set(face, plane);
	return plane;
}

function computePlane(face: StyledFace3D): Plane | null {
	const vertices = faceVertices(face);
	const a = vertices[0];
	if (!a) return null;
	for (let i = 1; i + 1 < vertices.length; i++) {
		const b = vertices[i]!,
			c = vertices[i + 1]!;
		const ux = x(b) - x(a),
			uy = y(b) - y(a),
			uz = z(b) - z(a);
		const vx = x(c) - x(a),
			vy = y(c) - y(a),
			vz = z(c) - z(a);
		const nx = uy * vz - uz * vy,
			ny = uz * vx - ux * vz,
			nz = ux * vy - uy * vx;
		const length = Math.hypot(nx, ny, nz);
		if (length < 1e-12) continue;
		return [
			nx / length,
			ny / length,
			nz / length,
			(nx * x(a) + ny * y(a) + nz * z(a)) / length,
		];
	}
	return null;
}

/** Cull before splitting so invisible surfaces do not create extra SVG fragments. */
export function visibleFaces(
	faces: readonly StyledFace3D[],
	eye: Point3D
): StyledFace3D[] {
	return faces.filter(face => {
		const plane = facePlane(face);
		return (
			plane !== null &&
			(faceDoubleSided(face) || distance(eye, plane) > epsilon)
		);
	});
}

function partition(
	faces: readonly StyledFace3D[],
	plane: Plane
): readonly [
	front: StyledFace3D[],
	back: StyledFace3D[],
	coplanar: StyledFace3D[],
] {
	const front: StyledFace3D[] = [],
		back: StyledFace3D[] = [],
		coplanar: StyledFace3D[] = [];
	for (const face of faces) {
		const vertices = faceVertices(face);
		const distances: number[] = [];
		let positive = false,
			negative = false;
		for (const vertex of vertices) {
			const d = distance(vertex, plane);
			distances.push(d);
			positive ||= d > epsilon;
			negative ||= d < -epsilon;
		}
		if (!positive && !negative) {
			coplanar.push(face);
			continue;
		}
		if (!negative) {
			front.push(face);
			continue;
		}
		if (!positive) {
			back.push(face);
			continue;
		}
		const f: Point3D[] = [],
			b: Point3D[] = [];
		for (let i = 0; i < vertices.length; i++) {
			const p = vertices[i]!,
				q = vertices[(i + 1) % vertices.length]!;
			const d = distances[i]!,
				e = distances[(i + 1) % distances.length]!;
			if (d >= -epsilon) f.push(p);
			if (d <= epsilon) b.push(p);
			if (
				(d > epsilon && e < -epsilon) ||
				(d < -epsilon && e > epsilon)
			) {
				const t = d / (d - e);
				const intersection = point<3>(
					x(p) + t * (x(q) - x(p)),
					y(p) + t * (y(q) - y(p)),
					z(p) + t * (z(q) - z(p))
				);
				f.push(intersection);
				b.push(intersection);
			}
		}
		if (f.length >= 3) {
			const split = face((_vertices, fill, layer, doubleSided) =>
				styledFace(f, fill, layer, doubleSided)
			);
			front.push(split);
		}
		if (b.length >= 3) {
			const split = face((_vertices, fill, layer, doubleSided) =>
				styledFace(b, fill, layer, doubleSided)
			);
			back.push(split);
		}
	}
	return [front, back, coplanar];
}

/** Splitting crossing polygons is essential: a single average depth cannot order them. */
export function buildFaceBSP(input: readonly StyledFace3D[]): FaceBSP | null {
	return build(input);
}

function build(input: readonly StyledFace3D[]): FaceBSP | null {
	const faces = input.filter(face => facePlane(face) !== null);
	if (!faces.length) return null;
	// Sample splitter candidates to balance traversal without a quadratic plane search.
	let best = facePlane(faces[0]!)!,
		bestScore = Infinity;
	const stride = Math.max(1, Math.floor(faces.length / 4));
	const sampleStride = Math.max(1, Math.floor(faces.length / 32));
	const candidates: Plane[] = [];
	if (faces.length > 32) {
		for (let axis = 0; axis < 3; axis++) {
			let min = Infinity,
				max = -Infinity;
			for (const face of faces)
				for (const p of faceVertices(face)) {
					min = Math.min(min, p[axis]![0]);
					max = Math.max(max, p[axis]![0]);
				}
			candidates.push([
				axis === 0 ? 1 : 0,
				axis === 1 ? 1 : 0,
				axis === 2 ? 1 : 0,
				(min + max) / 2,
			]);
		}
	}
	for (let i = 0; i < faces.length; i += stride) {
		const plane = facePlane(faces[i]!);
		if (plane) candidates.push(plane);
	}
	for (const plane of candidates) {
		let front = 0,
			back = 0,
			splits = 0;
		for (let j = 0; j < faces.length; j += sampleStride) {
			let positive = false,
				negative = false;
			for (const vertex of faceVertices(faces[j]!)) {
				const d = distance(vertex, plane);
				positive ||= d > epsilon;
				negative ||= d < -epsilon;
			}
			if (positive) front++;
			if (negative) back++;
			if (positive && negative) splits++;
		}
		const score = splits * 8 + Math.abs(front - back);
		if (score < bestScore) {
			best = plane;
			bestScore = score;
		}
	}
	const [front, back, coplanar] = partition(faces, best);
	const ahead = build(front),
		behind = build(back);
	return use => use(best, coplanar, ahead, behind);
}

export type FaceBSPSlot = 'static' | 'coplanar' | 'front' | 'back' | 'root';

/** Visit stable paint slots so moving polygons never displace static SVG elements. */
export function visitFaceBSP(
	tree: FaceBSP | null,
	eye: Point3D,
	moving: readonly StyledFace3D[],
	emit: (
		node: FaceBSP | null,
		slot: FaceBSPSlot,
		faces: readonly StyledFace3D[]
	) => void
): void {
	function sorted(node: FaceBSP | null, result: StyledFace3D[]): void {
		if (!node) return;
		node((plane, faces, ahead, behind) => {
			const front = distance(eye, plane) >= 0;
			sorted(front ? behind : ahead, result);
			result.push(...faces);
			sorted(front ? ahead : behind, result);
		});
	}
	function visit(
		node: FaceBSP | null,
		extra: readonly StyledFace3D[],
		parent: FaceBSP | null,
		slot: FaceBSPSlot
	): void {
		if (!node) {
			if (extra.length) {
				const ordered: StyledFace3D[] = [];
				sorted(buildFaceBSP(extra), ordered);
				emit(parent, slot, ordered);
			}
			return;
		}
		node((plane, faces, ahead, behind) => {
			const [frontFaces, backFaces, coplanar] = partition(extra, plane);
			const front = distance(eye, plane) >= 0;
			visit(
				front ? behind : ahead,
				front ? backFaces : frontFaces,
				node,
				front ? 'back' : 'front'
			);
			if (faces.length) emit(node, 'static', faces);
			if (coplanar.length) emit(node, 'coplanar', coplanar);
			visit(
				front ? ahead : behind,
				front ? frontFaces : backFaces,
				node,
				front ? 'front' : 'back'
			);
		});
	}
	visit(tree, moving, null, 'root');
}

/** Insert moving faces into a cached static tree, then paint from far to near. */
export function orderFaceBSP(
	tree: FaceBSP | null,
	eye: Point3D,
	moving: readonly StyledFace3D[] = []
): StyledFace3D[] {
	const result: StyledFace3D[] = [];
	visitFaceBSP(tree, eye, moving, (_node, _slot, faces) =>
		result.push(...faces)
	);
	return result;
}
