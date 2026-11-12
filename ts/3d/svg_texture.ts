import {
	cameraSpaceTransformFromPose,
	type YawPitchPose,
} from '#root/ts/math/camera_pose.js';
import { type Point3D, x, y, z } from '#root/ts/math/cartesian.js';
import {
	faceVertices,
	type Perspective,
	type StyledFace3D,
} from '#root/ts/math/wireframe_render.js';
import { unwrap } from '#root/ts/result/result.js';

export interface SVGTexture {
	image: { width: number; height: number; url: string };
	/** Affine world-to-texel coordinates survive BSP clipping and splitting. */
	u: readonly [number, number, number, number];
	v: readonly [number, number, number, number];
	light: number;
}
type Vertex = readonly [number, number, number, number, number];
type Screen = readonly [number, number];
export interface TextureTriangle {
	path: string;
	matrix: string;
}

/** Solve the SVG affine transform mapping three texture points to the screen. */
export function textureMatrix(
	uv: readonly Screen[],
	screen: readonly Screen[]
): string | null {
	const [p, q, r] = uv as readonly [Screen, Screen, Screen];
	const [a, b, c] = screen as readonly [Screen, Screen, Screen];
	const du = q[0] - p[0],
		dv = q[1] - p[1],
		eu = r[0] - p[0],
		ev = r[1] - p[1];
	const determinant = du * ev - eu * dv;
	if (Math.abs(determinant) < 1e-10) return null;
	const xx = ((b[0] - a[0]) * ev - (c[0] - a[0]) * dv) / determinant;
	const xy = ((c[0] - a[0]) * du - (b[0] - a[0]) * eu) / determinant;
	const yx = ((b[1] - a[1]) * ev - (c[1] - a[1]) * dv) / determinant;
	const yy = ((c[1] - a[1]) * du - (b[1] - a[1]) * eu) / determinant;
	return `matrix(${[xx, yx, xy, yy, a[0] - xx * p[0] - xy * p[1], a[1] - yx * p[0] - yy * p[1]].map(n => n.toFixed(6)).join(' ')})`;
}
const mix = (a: Vertex, b: Vertex, t: number): Vertex => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t,
	a[3] + (b[3] - a[3]) * t,
	a[4] + (b[4] - a[4]) * t,
];
function clip(vertices: Vertex[], distance: (v: Vertex) => number): Vertex[] {
	const result: Vertex[] = [];
	for (let i = 0; i < vertices.length; i++) {
		const a = vertices[i]!,
			b = vertices[(i + 1) % vertices.length]!;
		const da = distance(a),
			db = distance(b);
		if (da >= 0) result.push(a);
		if (da < 0 !== db < 0) result.push(mix(a, b, da / (da - db)));
	}
	return result;
}

/** SVG is affine: adaptively split perspective faces to a two-pixel screen error. */
export function createTextureProjector(
	pose: YawPitchPose,
	projection: Perspective
) {
	const transform = unwrap(cameraSpaceTransformFromPose(pose));
	const focal =
		Math.min(projection.width, projection.height) * projection.focalScale;
	const cx = projection.width / 2,
		cy = projection.height / 2;
	const screen = (v: Vertex): Screen => [
		cx + (v[0] * focal) / v[2],
		cy - (v[1] * focal) / v[2],
	];
	return (face: StyledFace3D, texture: SVGTexture): TextureTriangle[] => {
		const uv = (p: Point3D, axis: SVGTexture['u']) =>
			x(p) * axis[0] + y(p) * axis[1] + z(p) * axis[2] + axis[3];
		let polygon = faceVertices(face).map((p): Vertex => {
			const v = transform(p);
			return [x(v), y(v), z(v), uv(p, texture.u), uv(p, texture.v)];
		});
		for (const plane of [
			(v: Vertex) => v[2] - projection.nearPlane,
			(v: Vertex) => projection.farPlane - v[2],
			(v: Vertex) => v[2] * cx + v[0] * focal,
			(v: Vertex) => v[2] * cx - v[0] * focal,
			(v: Vertex) => v[2] * cy + v[1] * focal,
			(v: Vertex) => v[2] * cy - v[1] * focal,
		])
			polygon = clip(polygon, plane);
		const result: TextureTriangle[] = [];
		function triangle(a: Vertex, b: Vertex, c: Vertex, depth: number) {
			const points = [a, b, c] as const,
				projected = points.map(screen);
			let worst = 0,
				edge = 0;
			for (let i = 0; i < 3; i++) {
				const j = (i + 1) % 3,
					m = screen(mix(points[i]!, points[j]!, 0.5));
				const error = Math.hypot(
					m[0] - (projected[i]![0] + projected[j]![0]) / 2,
					m[1] - (projected[i]![1] + projected[j]![1]) / 2
				);
				if (error > worst) {
					worst = error;
					edge = i;
				}
			}
			if (worst > 2 && depth < 9) {
				const p = points[edge]!,
					q = points[(edge + 1) % 3]!,
					r = points[(edge + 2) % 3]!,
					m = mix(p, q, 0.5);
				triangle(p, m, r, depth + 1);
				triangle(m, q, r, depth + 1);
				return;
			}
			const matrix = textureMatrix(
				points.map(v => [v[3], v[4]]),
				projected
			);
			if (matrix)
				result.push({
					matrix,
					path:
						projected
							.map(
								(p, i) =>
									`${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`
							)
							.join('') + 'Z',
				});
		}
		for (let i = 1; i + 1 < polygon.length; i++)
			triangle(polygon[0]!, polygon[i]!, polygon[i + 1]!, 0);
		return result;
	};
}
