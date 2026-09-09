import type { Vec3 } from '#root/ts/3d/low_poly.js';
import { point } from '#root/ts/math/cartesian.js';
import {
	type StyledSegment3D,
	styleSegment,
} from '#root/ts/math/wireframe_render.js';

const foot = 0.3048;

// Published internal measurements; exterior offsets and elevations are schematic.
// See temple_church.md for the architectural references and limits of the model.
export const templeDimensions = {
	roundDiameter: 58 * foot,
	chancelLength: 82 * foot,
	chancelWidth: 58 * foot,
	chancelVaultHeight: 37 * foot,
} as const;

/** Temple Church, London: metres, Y up, east along +X. */
export function templeChurch(): readonly StyledSegment3D[] {
	const lines: StyledSegment3D[] = [];
	const radius = templeDimensions.roundDiameter / 2 + 0.65;
	const drum = 5.6;
	const west = radius * 0.72;
	const east = west + templeDimensions.chancelLength;
	const halfWidth = templeDimensions.chancelWidth / 2 + 0.65;
	const center = (east - radius - 3) / 2;
	const eaves = 12;
	const bay = (east - west) / 4;
	const aisle = (halfWidth * 2) / 3;

	function line(a: Vec3, b: Vec3, detail = false) {
		lines.push(
			styleSegment(
				[
					point<3>(a[0] - center, a[1], a[2]),
					point<3>(b[0] - center, b[1], b[2]),
				],
				{
					stroke: 'currentColor',
					width: detail ? 0.65 : 0.9,
					opacity: detail ? 0.5 : 0.85,
				}
			)
		);
	}
	function chain(vertices: readonly Vec3[], detail = false) {
		for (let i = 1; i < vertices.length; i++)
			line(vertices[i - 1]!, vertices[i]!, detail);
	}
	function polar(r: number, height: number, angle: number): Vec3 {
		return [Math.cos(angle) * r, height, Math.sin(angle) * r];
	}
	function ring(r: number, height: number, cut = false) {
		for (let i = 0; i < 72; i++) {
			const a = polar(r, height, (i / 72) * Math.PI * 2);
			const b = polar(r, height, ((i + 1) / 72) * Math.PI * 2);
			if (!cut || Math.max(a[0], b[0]) <= west) line(a, b);
		}
	}
	function rectangle(
		x1: number,
		x2: number,
		z1: number,
		z2: number,
		height: number
	) {
		chain([
			[x1, height, z1],
			[x2, height, z1],
			[x2, height, z2],
			[x1, height, z2],
			[x1, height, z1],
		]);
	}
	function column(x: number, z: number, height: number, r = 0.22) {
		for (const y of [0.25, height - 0.3, height]) {
			const vertices: Vec3[] = [];
			for (let i = 0; i <= 8; i++)
				vertices.push([
					x + Math.cos((i * Math.PI) / 4) * r * 1.5,
					y,
					z + Math.sin((i * Math.PI) / 4) * r * 1.5,
				]);
			chain(vertices, true);
		}
		for (let i = 0; i < 4; i++) {
			const dx = Math.cos((i * Math.PI) / 2) * r;
			const dz = Math.sin((i * Math.PI) / 2) * r;
			line([x + dx, 0.25, z + dz], [x + dx, height, z + dz], true);
		}
	}
	function arch(
		map: (u: number, y: number) => Vec3,
		width: number,
		bottom: number,
		spring: number,
		rise: number,
		pointed = true
	) {
		const half = width / 2;
		const vertices: Vec3[] = [map(-half, bottom), map(-half, spring)];
		for (let i = 1; i <= 20; i++) {
			const angle = (i / 20) * Math.PI;
			const u = -Math.cos(angle) * half;
			// Two circular arcs meet at the crown of a Gothic lancet.
			const y = pointed
				? (Math.sqrt(
						Math.max(0, width * width - (Math.abs(u) + half) ** 2)
					) /
						(Math.sqrt(3) * half)) *
					rise
				: Math.sin(angle) * rise;
			vertices.push(map(u, spring + y));
		}
		vertices.push(map(half, bottom));
		chain(vertices, true);
		line(map(-half, bottom), map(half, bottom), true);
	}

	// The Round: ambulatory, sloping annular roof, clerestory and parapet.
	for (const height of [0, 0.4, 3.2, 7.7, 8.2]) ring(radius, height, true);
	ring(drum, 10.5);
	ring(drum, 15.7);
	ring(drum, 16.2);
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2;
		if (Math.cos(a) * radius < west) {
			line(polar(radius, 8.2, a), polar(drum, 10.5, a), true);
			const buttress = (r: number, y: number) => polar(r, y, a);
			chain([
				buttress(radius, 0),
				buttress(radius + 0.65, 0),
				buttress(radius + 0.65, 3),
				buttress(radius + 0.35, 5),
				buttress(radius + 0.35, 7.5),
				buttress(radius, 7.7),
			]);
			const wa = a + Math.PI / 16;
			if (Math.cos(wa) * radius < west && Math.abs(wa - Math.PI) > 0.3) {
				arch(
					(u, y) => [
						Math.cos(wa) * radius - Math.sin(wa) * u,
						y,
						Math.sin(wa) * radius + Math.cos(wa) * u,
					],
					1.05,
					3.5,
					6.25,
					0.6,
					false
				);
			}
		}
		const wa = a + Math.PI / 16;
		arch(
			(u, y) => [
				Math.cos(wa) * drum - Math.sin(wa) * u,
				y,
				Math.sin(wa) * drum + Math.cos(wa) * u,
			],
			0.7,
			13.6,
			14.4,
			0.4,
			false
		);
		line(polar(drum, 16.2, a), [0, 19.2, 0], true);
	}
	for (let i = 0; i < 24; i++) {
		const a = (i / 24) * Math.PI * 2;
		const b = ((i + 0.5) / 24) * Math.PI * 2;
		chain([
			polar(drum, 16.2, a),
			polar(drum, 16.75, a),
			polar(drum, 16.75, b),
			polar(drum, 16.2, b),
		]);
	}
	for (let i = 0; i < 6; i++) {
		const a = ((i + 0.5) / 6) * Math.PI * 2;
		const b = ((i + 1.5) / 6) * Math.PI * 2;
		const p = polar(drum, 0, a),
			q = polar(drum, 0, b);
		column(p[0], p[2], 7.4, 0.28);
		arch(
			(u, y) => {
				const t = u / drum + 0.5;
				return [p[0] + (q[0] - p[0]) * t, y, p[2] + (q[2] - p[2]) * t];
			},
			drum,
			7.4,
			7.4,
			3
		);
	}

	// Four-bay, three-aisled hall chancel, with three parallel pitched roofs.
	for (const height of [0, 0.4, 3, eaves - 0.5, eaves])
		rectangle(west, east, -halfWidth, halfWidth, height);
	for (let i = 0; i < 3; i++) {
		const z1 = -halfWidth + i * aisle;
		const z2 = z1 + aisle;
		const mid = (z1 + z2) / 2;
		for (const x of [west, east])
			chain([
				[x, 0, z1],
				[x, eaves, z1],
				[x, 16, mid],
				[x, eaves, z2],
				[x, 0, z2],
			]);
		line([west, 16, mid], [east, 16, mid]);
		line([west, eaves, z1], [east, eaves, z1]);
		for (let j = 0; j < 3; j++) {
			arch(
				(u, y) => [east, y, mid + (j - 1) * 1.45 + u],
				1,
				3.6,
				j === 1 ? 9.3 : 8.3,
				1.7
			);
		}
	}
	for (const side of [-1, 1]) {
		const z = halfWidth * side;
		for (let i = 0; i <= 4; i++) {
			const x = west + bay * i;
			for (const dx of [-0.35, 0.35])
				chain([
					[x + dx, 0, z],
					[x + dx, 0, z + side * 1.15],
					[x + dx, 3, z + side * 1.15],
					[x + dx, 5.1, z + side * 0.7],
					[x + dx, 8.7, z + side * 0.7],
					[x + dx, 11.5, z],
				]);
			line(
				[x - 0.35, 3, z + side * 1.15],
				[x + 0.35, 3, z + side * 1.15]
			);
			if (i === 4) continue;
			for (let j = 0; j < 3; j++) {
				arch(
					(u, y) => [x + bay / 2 + (j - 1) * 1.45 + u, y, z],
					1,
					3.6,
					j === 1 ? 9.3 : 8.3,
					1.7
				);
			}
		}
		for (let i = 1; i < 4; i++)
			column(west + i * bay, (side * aisle) / 2, 7.7);
	}
	// Vault ribs give the transparent model an interior as the east end turns away.
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 3; j++) {
			const x1 = west + i * bay,
				x2 = x1 + bay;
			const z1 = -halfWidth + j * aisle,
				z2 = z1 + aisle;
			for (const reverse of [false, true]) {
				const vertices: Vec3[] = [];
				for (let k = 0; k <= 16; k++) {
					const t = k / 16;
					vertices.push([
						x1 + (x2 - x1) * t,
						7.7 +
							Math.sin(t * Math.PI) *
								(templeDimensions.chancelVaultHeight - 7.7),
						reverse ? z2 - (z2 - z1) * t : z1 + (z2 - z1) * t,
					]);
				}
				chain(vertices, true);
			}
		}
	}

	// Deep west porch and the approximately 4.4 m × 4 m Romanesque doorway.
	const front = -radius - 3;
	for (const y of [0, 4.8]) rectangle(front, -radius + 0.4, -2.8, 2.8, y);
	for (const x of [front, -radius + 0.4]) {
		chain([
			[x, 0, -2.8],
			[x, 4.8, -2.8],
			[x, 6.8, 0],
			[x, 4.8, 2.8],
			[x, 0, 2.8],
		]);
	}
	line([front, 6.8, 0], [-radius + 0.4, 6.8, 0]);
	for (const inset of [0, 0.2, 0.4])
		arch(
			(u, y) => [front, y, u],
			4.4 - inset * 2,
			0,
			1.8,
			2.2 - inset,
			false
		);
	return lines;
}
