import type { YawPitchPose } from '#root/ts/math/camera_pose.js';
import {
	type Point3D,
	point,
	x as px,
	y as py,
	z as pz,
} from '#root/ts/math/cartesian.js';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';
/** Small, flat-shaded meshes for interactive illustrations. Coordinates are Y-up. */
export type Vec3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];
export type Triangle = readonly [Vec3, Vec3, Vec3];
export type Geometry = readonly (readonly Vec3[])[];

export function rgb(hex: number): RGB {
	return [
		((hex >> 16) & 255) / 255,
		((hex >> 8) & 255) / 255,
		(hex & 255) / 255,
	];
}

export function sphere(sides = 10, rings = 7): Geometry {
	const faces: Vec3[][] = [];
	const grid: Vec3[][] = [];
	const vertex = (i: number, j: number): Vec3 => {
		i %= sides;
		const row = grid[j] ?? (grid[j] = []);
		const cached = row[i];
		if (cached) return cached;
		const latitude = (j / rings) * Math.PI;
		const longitude = (i / sides) * Math.PI * 2;
		return (row[i] = [
			Math.sin(latitude) * Math.cos(longitude),
			Math.cos(latitude),
			Math.sin(latitude) * Math.sin(longitude),
		]);
	};
	for (let j = 0; j < rings; j++)
		for (let i = 0; i < sides; i++) {
			// Latitude bands form planar quads. Keeping their shared diagonal out of
			// the mesh avoids extra BSP splits and SVG paths without changing the surface.
			if (j === 0)
				faces.push([
					vertex(i, j),
					vertex(i + 1, j + 1),
					vertex(i, j + 1),
				]);
			else if (j === rings - 1)
				faces.push([vertex(i, j), vertex(i + 1, j), vertex(i, j + 1)]);
			else
				faces.push([
					vertex(i, j),
					vertex(i + 1, j),
					vertex(i + 1, j + 1),
					vertex(i, j + 1),
				]);
		}
	return faces;
}

/** A cylinder with its bottom at -1 and top at +1; zero top radius makes a cone. */
export function cylinder(sides = 16, topRadius = 1): Geometry {
	const faces: Vec3[][] = [],
		bottom: Vec3[] = [],
		top: Vec3[] = [];
	for (let i = 0; i < sides; i++) {
		const a = (i / sides) * Math.PI * 2,
			b = ((i + 1) / sides) * Math.PI * 2;
		const p: Vec3 = [Math.cos(a), -1, Math.sin(a)],
			q: Vec3 = [Math.cos(b), -1, Math.sin(b)];
		const r: Vec3 = [Math.cos(a) * topRadius, 1, Math.sin(a) * topRadius],
			t: Vec3 = [Math.cos(b) * topRadius, 1, Math.sin(b) * topRadius];
		faces.push(topRadius === 0 ? [p, r, q] : [p, r, t, q]);
		bottom.push(p);
		top.unshift(r);
	}
	faces.push(bottom);
	if (topRadius > 0) faces.push(top);
	return faces;
}

export const cube: Geometry = (() => {
	const points: Vec3[] = [
		[-1, -1, -1],
		[1, -1, -1],
		[1, 1, -1],
		[-1, 1, -1],
		[-1, -1, 1],
		[1, -1, 1],
		[1, 1, 1],
		[-1, 1, 1],
	];
	return [
		[0, 3, 2, 1],
		[4, 5, 6, 7],
		[0, 4, 7, 3],
		[1, 2, 6, 5],
		[3, 7, 6, 2],
		[0, 1, 5, 4],
	].map(indices => indices.map(index => points[index]!));
})();

export interface Transform {
	position: Vec3;
	scale: Vec3;
	yaw?: number;
	roll?: number;
	layer?: number;
}

export function appendMesh(
	target: StyledFace3D[],
	geometry: Geometry,
	color: RGB,
	transform: Transform
): void {
	const { position: p, scale: s, yaw = 0, roll = 0 } = transform;
	const cy = Math.cos(yaw),
		sy = Math.sin(yaw),
		cr = Math.cos(roll),
		sr = Math.sin(roll);
	const transformed = new Map<Vec3, Point3D>();
	const convert = (vertex: Vec3): Point3D => {
		const cached = transformed.get(vertex);
		if (cached) return cached;
		const [x, y, z] = vertex;
		const rx = x * s[0] * cr - y * s[1] * sr;
		const ry = x * s[0] * sr + y * s[1] * cr;
		const result = point<3>(
			rx * cy + z * s[2] * sy + p[0],
			ry + p[1],
			-rx * sy + z * s[2] * cy + p[2]
		);
		transformed.set(vertex, result);
		return result;
	};
	for (const face of geometry) {
		if (face.length < 3) continue;
		const vertices = face.map(convert);
		const a = vertices[0]!,
			b = vertices[1]!,
			c = vertices[2]!;
		const u = [px(b) - px(a), py(b) - py(a), pz(b) - pz(a)] as const;
		const v = [px(c) - px(a), py(c) - py(a), pz(c) - pz(a)] as const;
		const nx = u[1] * v[2] - u[2] * v[1],
			ny = u[2] * v[0] - u[0] * v[2],
			nz = u[0] * v[1] - u[1] * v[0];
		const length = Math.hypot(nx, ny, nz) || 1;
		// A small shade palette preserves the faceted look and lets adjacent
		// SVG fragments share paint instead of differing by a single RGB step.
		const light =
			Math.round(
				(0.72 +
					0.28 *
						Math.max(
							0,
							(-nx * 0.45 + ny * 0.8 + nz * 0.4) / length
						)) *
					32
			) / 32;
		const fill =
			'#' +
			color
				.map(channel =>
					Math.round(channel * light * 255)
						.toString(16)
						.padStart(2, '0')
				)
				.join('');
		target.push({
			vertices,
			fill,
			layer: transform.layer ?? 1000,
		});
	}
}

export interface OrbitCamera {
	yaw: number;
	pitch: number;
	distance: number;
	target: Vec3;
}

export function orbitPose(camera: OrbitCamera): YawPitchPose {
	const { yaw, pitch, distance, target } = camera;
	return {
		position: point<3>(
			target[0] + Math.sin(yaw) * Math.cos(pitch) * distance,
			target[1] + Math.sin(pitch) * distance,
			target[2] + Math.cos(yaw) * Math.cos(pitch) * distance
		),
		yaw: yaw + Math.PI,
		pitch,
	};
}
