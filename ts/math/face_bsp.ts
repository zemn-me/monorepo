import { type Point3D, point, x, y, z } from '#root/ts/math/cartesian.js';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';

// World-space tolerance keeps coplanar faces stable as the camera moves.
const epsilon = 1e-7;
type Plane = readonly [number, number, number, number];
export interface FaceBSP {
	readonly plane: Plane;
	readonly faces: readonly StyledFace3D[];
	readonly front: FaceBSP | null;
	readonly back: FaceBSP | null;
}

function distance(p: Point3D, plane: Plane): number {
	return x(p) * plane[0] + y(p) * plane[1] + z(p) * plane[2] - plane[3];
}

function facePlane(face: StyledFace3D): Plane | null {
	const a = face.vertices[0];
	if (!a) return null;
	for (let i = 1; i + 1 < face.vertices.length; i++) {
		const b = face.vertices[i]!,
			c = face.vertices[i + 1]!;
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
			(face.doubleSided || distance(eye, plane) > epsilon)
		);
	});
}

function partition(
	faces: readonly StyledFace3D[],
	plane: Plane
): { front: StyledFace3D[]; back: StyledFace3D[]; coplanar: StyledFace3D[] } {
	const front: StyledFace3D[] = [],
		back: StyledFace3D[] = [],
		coplanar: StyledFace3D[] = [];
	for (const face of faces) {
		const distances = face.vertices.map(p => distance(p, plane));
		const positive = distances.some(d => d > epsilon),
			negative = distances.some(d => d < -epsilon);
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
		for (let i = 0; i < face.vertices.length; i++) {
			const p = face.vertices[i]!,
				q = face.vertices[(i + 1) % face.vertices.length]!;
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
		if (f.length >= 3) front.push({ ...face, vertices: f });
		if (b.length >= 3) back.push({ ...face, vertices: b });
	}
	return { front, back, coplanar };
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
				for (const p of face.vertices) {
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
			for (const vertex of faces[j]!.vertices) {
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
	const { front, back, coplanar } = partition(faces, best);
	return {
		plane: best,
		faces: coplanar,
		front: build(front),
		back: build(back),
	};
}

/** Insert moving faces into a cached static tree, then paint from far to near. */
export function orderFaceBSP(
	tree: FaceBSP | null,
	eye: Point3D,
	moving: readonly StyledFace3D[] = []
): StyledFace3D[] {
	const result: StyledFace3D[] = [];
	function visit(node: FaceBSP | null, extra: readonly StyledFace3D[]): void {
		if (!node) {
			if (extra.length) visit(buildFaceBSP(extra), []);
			return;
		}
		const parts = partition(extra, node.plane);
		const inFront = distance(eye, node.plane) >= 0;
		visit(
			inFront ? node.back : node.front,
			inFront ? parts.back : parts.front
		);
		result.push(...node.faces, ...parts.coplanar);
		visit(
			inFront ? node.front : node.back,
			inFront ? parts.front : parts.back
		);
	}
	visit(tree, moving);
	return result;
}
