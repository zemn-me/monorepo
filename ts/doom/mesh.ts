import type { SVGTexture } from '#root/ts/3d/svg_texture.js';
import type { DoomLevel, MapPoint, Side } from '#root/ts/doom/level.js';
import { ceiling, type Doors } from '#root/ts/doom/walk.js';
import { type Point3D, point } from '#root/ts/math/cartesian.js';
import {
	type StyledFace3D,
	styledFace,
} from '#root/ts/math/wireframe_render.js';

/** Build the same sector geometry with the WAD's sidedefs, offsets and lighting. */
export function texturedMesh(
	level: DoomLevel,
	doors: Doors,
	materials: Map<string, SVGTexture>
): StyledFace3D[] {
	materials.clear();
	const faces: StyledFace3D[] = [];
	let id = 0;
	function face(
		vertices: Point3D[],
		name: string,
		u: SVGTexture['u'],
		v: SVGTexture['v'],
		light: number
	) {
		const image = level.textures[name];
		if (!image) return;
		const key = `doom-material-${id++}`;
		materials.set(key, {
			image,
			u,
			v,
			light: Math.max(0.18, Math.min(1, light / 255)),
		});
		faces.push(styledFace(vertices, key));
	}
	for (const cell of level.cells) {
		const sector = level.rooms[cell.sector]!;
		for (const upper of [false, true]) {
			const texture = upper ? sector.ceilingTexture : sector.floorTexture;
			if (texture === 'F_SKY1') continue;
			const height = upper
				? ceiling(level, cell.sector, doors)
				: sector.floor;
			const vertices = cell.polygon.map(p =>
				point<3>(p[0], height, p[1])
			);
			face(
				upper ? vertices.reverse() : vertices,
				`flat:${texture}`,
				[64, 0, 0, level.origin[0]!],
				[0, 0, 64, -level.origin[1]!],
				sector.light
			);
		}
	}
	for (const line of level.lines) {
		function wall(
			a: MapPoint,
			b: MapPoint,
			side: Side,
			other: Side | null
		) {
			const room = level.rooms[side.sector]!,
				top = ceiling(level, side.sector, doors);
			const dx = b[0] - a[0],
				dz = b[1] - a[1],
				length = Math.hypot(dx, dz);
			if (!length) return;
			function span(
				bottom: number,
				upper: number,
				texture: string,
				anchor: number
			) {
				if (upper <= bottom || texture === '-') return;
				face(
					[
						point<3>(a[0], bottom, a[1]),
						point<3>(b[0], bottom, b[1]),
						point<3>(b[0], upper, b[1]),
						point<3>(a[0], upper, a[1]),
					],
					`wall:${texture}`,
					[
						(64 * dx) / length,
						0,
						(64 * dz) / length,
						side.xOffset - (64 * (a[0] * dx + a[1] * dz)) / length,
					],
					[0, -64, 0, anchor * 64 + side.yOffset],
					room.light * (Math.abs(dx) > Math.abs(dz) ? 0.9 : 1)
				);
			}
			const textureHeight = (name: string) =>
				(level.textures[`wall:${name}`]?.height ?? 128) / 64;
			if (!other) {
				span(
					room.floor,
					top,
					side.middle,
					line.flags & 16
						? room.floor + textureHeight(side.middle)
						: top
				);
				return;
			}
			const neighbor = level.rooms[other.sector]!,
				neighborTop = ceiling(level, other.sector, doors);
			if (
				!(
					room.ceilingTexture === 'F_SKY1' &&
					neighbor.ceilingTexture === 'F_SKY1'
				)
			)
				span(
					Math.max(room.floor, neighborTop),
					top,
					side.upper,
					line.flags & 8
						? top
						: neighborTop + textureHeight(side.upper)
				);
			span(
				room.floor,
				Math.min(top, neighbor.floor),
				side.lower,
				line.flags & 16 ? top : neighbor.floor
			);
			if (side.middle !== '-') {
				const bottom = Math.max(room.floor, neighbor.floor),
					upper = Math.min(top, neighborTop);
				span(
					bottom,
					upper,
					side.middle,
					line.flags & 16
						? bottom + textureHeight(side.middle)
						: upper
				);
			}
		}
		wall(line.a, line.b, line.front, line.back);
		if (line.back) wall(line.b, line.a, line.back, line.front);
	}
	return faces;
}
