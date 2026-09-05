import { expect, test } from '@jest/globals';

import { cube, cylinder, sphere, type Vec3 } from '#root/ts/3d/low_poly.js';

const key = (p: Vec3) => p.map(n => Number(n.toFixed(7))).join(',');

test('consolidated primitives remain closed with planar, outward-facing polygons', () => {
	for (const mesh of [
		cube,
		sphere(8, 5),
		sphere(8, 4),
		sphere(6, 3),
		sphere(4, 2),
		cylinder(12),
		cylinder(7, 0),
	]) {
		const edges = new Map<string, number>();
		for (const face of mesh) {
			const [a, b, c] = face as [Vec3, Vec3, Vec3, ...Vec3[]];
			const u = b.map((n, i) => n - a[i]!),
				v = c.map((n, i) => n - a[i]!);
			const normal = [
				u[1]! * v[2]! - u[2]! * v[1]!,
				u[2]! * v[0]! - u[0]! * v[2]!,
				u[0]! * v[1]! - u[1]! * v[0]!,
			];
			expect(Math.hypot(...normal)).toBeGreaterThan(1e-6);
			expect(
				normal.reduce(
					(sum, n, i) => sum + n * (a[i]! - (i === 1 ? -0.5 : 0)),
					0
				)
			).toBeGreaterThan(0);
			for (let i = 0; i < face.length; i++) {
				const p = face[i]!,
					q = face[(i + 1) % face.length]!;
				expect(
					Math.abs(
						normal.reduce(
							(sum, n, j) => sum + n * (p[j]! - a[j]!),
							0
						)
					)
				).toBeLessThan(1e-7);
				const edge = `${key(p)}>${key(q)}`;
				edges.set(edge, (edges.get(edge) ?? 0) + 1);
			}
		}
		for (const [edge, count] of edges) {
			const [a, b] = edge.split('>');
			expect(count).toBe(1);
			expect(edges.get(`${b}>${a}`)).toBe(1);
		}
	}
});
