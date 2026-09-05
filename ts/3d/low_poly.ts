import type { YawPitchPose } from '#root/ts/math/camera_pose.js';
import { point } from '#root/ts/math/cartesian.js';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';
/** Small, flat-shaded meshes for interactive illustrations. Coordinates are Y-up. */
export type Vec3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];
export type Triangle = readonly [Vec3, Vec3, Vec3];
export type Geometry = readonly Triangle[];

export function rgb(hex: number): RGB {
	return [
		((hex >> 16) & 255) / 255,
		((hex >> 8) & 255) / 255,
		(hex & 255) / 255,
	];
}

export function sphere(sides = 10, rings = 7): Geometry {
	const triangles: Triangle[] = [];
	const vertex = (i: number, j: number): Vec3 => {
		const latitude = (j / rings) * Math.PI;
		const longitude = (i / sides) * Math.PI * 2;
		return [
			Math.sin(latitude) * Math.cos(longitude),
			Math.cos(latitude),
			Math.sin(latitude) * Math.sin(longitude),
		];
	};
	for (let j = 0; j < rings; j++) {
		for (let i = 0; i < sides; i++) {
			triangles.push(
				[vertex(i, j), vertex(i, j + 1), vertex(i + 1, j + 1)],
				[vertex(i, j), vertex(i + 1, j + 1), vertex(i + 1, j)]
			);
		}
	}
	return triangles.map(([a, b, c]) => [a, c, b]);
}

/** A cylinder with its bottom at -1 and top at +1; zero top radius makes a cone. */
export function cylinder(sides = 16, topRadius = 1): Geometry {
	const triangles: Triangle[] = [];
	for (let i = 0; i < sides; i++) {
		const a = (i / sides) * Math.PI * 2;
		const b = ((i + 1) / sides) * Math.PI * 2;
		const p: Vec3 = [Math.cos(a), -1, Math.sin(a)];
		const q: Vec3 = [Math.cos(b), -1, Math.sin(b)];
		const r: Vec3 = [Math.cos(a) * topRadius, 1, Math.sin(a) * topRadius];
		const s: Vec3 = [Math.cos(b) * topRadius, 1, Math.sin(b) * topRadius];
		triangles.push(
			[p, r, s],
			[p, s, q],
			[[0, 1, 0], s, r],
			[[0, -1, 0], p, q]
		);
	}
	return triangles;
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
	].flatMap(
		([a, b, c, d]) =>
			[
				[points[a!]!, points[b!]!, points[c!]!],
				[points[a!]!, points[c!]!, points[d!]!],
			] as Triangle[]
	);
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
	const convert = ([x, y, z]: Vec3): Vec3 => {
		const rx = x * s[0] * cr - y * s[1] * sr;
		const ry = x * s[0] * sr + y * s[1] * cr;
		return [
			rx * cy + z * s[2] * sy + p[0],
			ry + p[1],
			-rx * sy + z * s[2] * cy + p[2],
		];
	};
	for (const triangle of geometry) {
		const a = convert(triangle[0]),
			b = convert(triangle[1]),
			c = convert(triangle[2]);
		const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
		const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]] as const;
		const nx = u[1] * v[2] - u[2] * v[1],
			ny = u[2] * v[0] - u[0] * v[2],
			nz = u[0] * v[1] - u[1] * v[0];
		const length = Math.hypot(nx, ny, nz) || 1;
		const light =
			0.72 +
			0.28 * Math.max(0, (-nx * 0.45 + ny * 0.8 + nz * 0.4) / length);
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
			vertices: [point<3>(...a), point<3>(...b), point<3>(...c)],
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
