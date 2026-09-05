import {
	appendMesh,
	cube,
	cylinder,
	type Geometry,
	rgb,
	sphere,
	type Vec3,
} from '#root/ts/3d/low_poly.js';
import type { StyledFace3D } from '#root/ts/math/wireframe_render.js';
import { PACK, type Park } from '#root/ts/pulumi/eggsfordogs.com/app/scene.js';

const round = sphere(8, 4);
const smallRound = sphere(6, 3);
const tinyRound = sphere(4, 2);
const disc = cylinder(32);
const smallDisc = cylinder(16);
const collar = cylinder(12);
const flowerPetal = cylinder(5);
const trunk = cylinder(7, 0.75);
const cone = cylinder(7, 0);
const blade: Geometry = [
	[
		[-1, -1, 0],
		[1, -1, 0],
		[0, 1, 0],
	],
	[
		[0, -1, -1],
		[0, 1, 0],
		[0, -1, 1],
	],
];
const eggShape = sphere(8, 6).map(
	triangle =>
		triangle.map(
			([x, y, z]) =>
				[x * (0.85 - y * 0.18), y, z * (0.85 - y * 0.18)] as Vec3
		) as unknown as Geometry[number]
);

function part(
	vertices: StyledFace3D[],
	geometry: Geometry,
	color: number,
	position: Vec3,
	scale: Vec3,
	yaw = 0,
	roll = 0
) {
	// Subpixel eyes, glints and flower centres need only a small closed solid.
	if (geometry === smallRound && Math.max(...scale) < 0.17)
		geometry = tinyRound;
	if (geometry === disc && Math.max(...scale) < 2) geometry = smallDisc;
	appendMesh(vertices, geometry, rgb(color), {
		position,
		scale,
		yaw,
		roll,
		layer: position[1] < 0.24 ? Math.round((position[1] + 2) * 100) : 1000,
	});
}

export function buildParkMesh(night = false): StyledFace3D[] {
	const v: StyledFace3D[] = [];
	// A layered, floating slice of lawn keeps the whole world legible at a glance.
	part(v, disc, night ? 0x202538 : 0xdcdac8, [0, -1.32, 0], [8.8, 0.025, 8]);
	part(v, cylinder(32, 1.03), 0xb6986e, [0, -0.65, 0], [8.1, 0.55, 7.3]);
	part(v, cylinder(32), 0x799957, [0, -0.06, 0], [8.35, 0.15, 7.5]);
	part(v, disc, 0xa9be79, [0, 0.095, 0], [8.3, 0.018, 7.45]);
	part(v, disc, 0xc4cf8c, [0, 0.119, 0], [6.45, 0.012, 5.8]);
	// Pond, pebbles and lily pads, tucked away from the playable lawn.
	part(v, disc, 0xd8ce9d, [-5.5, 0.15, 2.8], [1.95, 0.025, 1.45]);
	part(v, disc, 0x77bdba, [-5.5, 0.185, 2.8], [1.7, 0.025, 1.2]);
	for (let i = 0; i < 4; i++)
		part(
			v,
			disc,
			0xa5d6c8,
			[-6.2 + i * 0.38, 0.215, 2.5 + i * 0.17],
			[0.23, 0.005, 0.055]
		);
	part(v, disc, 0x65956c, [-5.9, 0.22, 3.35], [0.34, 0.008, 0.28]);
	part(v, smallRound, 0xf2c2bc, [-5.9, 0.3, 3.35], [0.13, 0.1, 0.13]);
	const trees = [
		[-6, -3, 1.1],
		[-3.9, -5.4, 0.9],
		[0.5, -6, 1.15],
		[5.8, -3.7, 1],
		[6.5, 1.7, 0.85],
	];
	for (const [x, z, s] of trees as [number, number, number][]) {
		part(
			v,
			disc,
			0x8fa76a,
			[x + 0.4, 0.15, z + 0.3],
			[1.3 * s, 0.01, 0.85 * s]
		);
		part(v, trunk, 0x98724e, [x, 1 * s, z], [0.19 * s, 1 * s, 0.19 * s]);
		part(v, round, 0x6f956a, [x, 2.7 * s, z], [1.3 * s, 1.6 * s, 1.15 * s]);
		part(
			v,
			round,
			0x83a571,
			[x - 0.55 * s, 2.4 * s, z + 0.3],
			[0.95 * s, 1.05 * s, 0.8 * s]
		);
		part(
			v,
			round,
			0xa3ba7a,
			[x + 0.25 * s, 3.35 * s, z + 0.15],
			[0.8 * s, 0.95 * s, 0.75 * s]
		);
	}
	// Little red doghouse and a striped roof.
	part(v, cube, 0xcf8063, [3.8, 0.7, -4.2], [0.85, 0.6, 0.8]);
	part(v, cube, 0x704c42, [3.8, 0.57, -3.388], [0.34, 0.47, 0.018]);
	part(v, round, 0x704c42, [3.8, 1, -3.37], [0.34, 0.31, 0.025]);
	part(v, cube, 0xf1d7a7, [3.31, 1.5, -4.2], [0.62, 0.12, 1], 0, 0.55);
	part(v, cube, 0xe5c696, [4.29, 1.5, -4.2], [0.62, 0.12, 1], 0, -0.55);
	part(v, smallRound, 0xf6e3b3, [3.8, 1.29, -3.34], [0.16, 0.08, 0.03]);
	// Short fence around the far edge; the front stays open and welcoming.
	for (let i = 0; i < 13; i++) {
		const angle = Math.PI * 0.99 + (i * Math.PI) / 14;
		const x = Math.cos(angle) * 7.7,
			z = Math.sin(angle) * 6.8;
		part(v, cube, 0xe9d9af, [x, 0.62, z], [0.095, 0.55, 0.095]);
		part(v, cone, 0xe9d9af, [x, 1.24, z], [0.14, 0.12, 0.14]);
		if (i < 12) {
			const a = angle + Math.PI / 28,
				length = 0.87;
			for (const h of [0.5, 0.9])
				part(
					v,
					cube,
					0xe6d4a9,
					[Math.cos(a) * 7.7, h, Math.sin(a) * 6.8],
					[length, 0.07, 0.06],
					Math.PI / 2 - a
				);
		}
	}
	// Deterministic flowers and grass, so hydration and previews share one garden.
	for (let i = 0; i < 54; i++) {
		const a = i * 2.39996,
			r = 6.2 + (Math.sin(i * 12.3) + 1) * 0.55;
		const x = Math.cos(a) * r,
			z = Math.sin(a) * r * 0.86;
		if (x < -4 && z > 1) continue;
		part(v, blade, 0x7e9d60, [x, 0.27, z], [0.06, 0.15, 0.06]);
		if (i % 3 === 0) {
			const tint = i % 2 ? 0xfff1cd : 0xf3c48d;
			for (let p = 0; p < 5; p++)
				part(
					v,
					flowerPetal,
					tint,
					[
						x + Math.cos(p * 1.256) * 0.105,
						0.4,
						z + Math.sin(p * 1.256) * 0.105,
					],
					[0.095, 0.04, 0.095]
				);
			part(v, smallRound, 0xe1ac42, [x, 0.43, z], [0.065, 0.045, 0.065]);
		}
	}
	for (const [x, z] of [
		[-7, 0],
		[6, 3.7],
		[-2, -6.4],
	])
		part(v, smallRound, 0xb1b49c, [x!, 0.35, z!], [0.45, 0.27, 0.35]);
	// A toy ball and a bowl by the house.
	part(v, round, 0xda8262, [4.8, 0.37, 3.2], [0.25, 0.25, 0.25]);
	part(v, disc, 0xe6bf64, [2.5, 0.25, -3.3], [0.38, 0.13, 0.38]);
	part(v, disc, 0x88b9b2, [2.5, 0.39, -3.3], [0.3, 0.008, 0.3]);
	return v;
}

export function buildActors(park: Park): StyledFace3D[] {
	const v: StyledFace3D[] = [];
	park.dogs.forEach((dog, i) => {
		const spec = PACK[i]!;
		const size = i === 5 ? 0.78 : i === 1 ? 0.88 : 1;
		const bounce =
			dog.joy > 0
				? Math.abs(Math.sin(dog.joy * 9)) * 0.3
				: dog.moving
					? Math.abs(Math.sin(park.time * 9 + i)) * 0.06
					: 0;
		const cy = Math.cos(dog.heading),
			sy = Math.sin(dog.heading);
		const p = (
			geometry: Geometry,
			color: number,
			position: Vec3,
			scale: Vec3,
			roll = 0,
			yaw = 0
		) =>
			part(
				v,
				geometry,
				color,
				[
					dog.x + (position[0] * cy + position[2] * sy) * size,
					0.15 + position[1] * size + bounce,
					dog.z + (-position[0] * sy + position[2] * cy) * size,
				],
				[scale[0] * size, scale[1] * size, scale[2] * size],
				dog.heading + yaw,
				roll
			);
		part(
			v,
			disc,
			0x9cad73,
			[dog.x, 0.15, dog.z],
			[0.56 * size, 0.008, 0.76 * size],
			dog.heading
		);
		p(round, spec.coat, [0, 0.63, 0], [0.39, 0.43, 0.63]);
		p(round, spec.patch, [0, 0.66, 0.37], [0.32, 0.35, 0.26]);
		for (const side of [-1, 1])
			for (const end of [-1, 1]) {
				const gait = dog.moving
					? Math.sin(park.time * 11 + side * end * 1.5) * 0.12
					: 0;
				p(
					smallRound,
					spec.coat,
					[side * 0.27, 0.26 + gait, end * 0.36],
					[0.15, 0.27, 0.16]
				);
				p(
					smallRound,
					spec.patch,
					[side * 0.27, 0.1 + Math.max(0, gait), end * 0.36 + 0.055],
					[0.16, 0.1, 0.2]
				);
			}
		p(round, spec.coat, [0, 1.12, 0.48], [0.43, 0.43, 0.39]);
		p(round, spec.patch, [0, 0.98, 0.78], [0.29, 0.21, 0.24]);
		p(smallRound, 0x3e3732, [0, 1.055, 0.99], [0.13, 0.085, 0.07]);
		for (const side of [-1, 1]) {
			p(
				smallRound,
				0x342f2b,
				[side * 0.19, 1.24, 0.806],
				[0.054, 0.066, 0.036]
			);
			p(
				smallRound,
				0xfff9e7,
				[side * 0.19 - 0.012, 1.265, 0.835],
				[0.017, 0.019, 0.009]
			);
			p(
				smallRound,
				i % 2 ? spec.patch : spec.coat,
				[side * 0.4, 1.13, 0.43],
				[0.17, 0.34, 0.2],
				side * 0.28
			);
		}
		p(smallRound, 0xe39393, [0, 0.83, 0.87], [0.095, 0.13, 0.055]);
		p(collar, spec.collar, [0, 0.87, 0.41], [0.35, 0.065, 0.3]);
		p(smallRound, 0xf4cf69, [0, 0.8, 0.72], [0.075, 0.095, 0.035]);
		const wag = Math.sin(park.time * (dog.joy > 0 ? 24 : 10) + i) * 0.5;
		p(
			smallRound,
			spec.coat,
			[wag * 0.24, 0.98, -0.64],
			[0.13, 0.34, 0.14],
			wag
		);
		if (dog.joy > 0) {
			const h = 1.95 + (1.7 - dog.joy) * 0.35;
			p(smallRound, 0xdd7b7e, [-0.1, h, 0], [0.15, 0.15, 0.09]);
			p(smallRound, 0xdd7b7e, [0.1, h, 0], [0.15, 0.15, 0.09]);
			p(cone, 0xdd7b7e, [0, h - 0.12, 0], [0.22, 0.22, 0.1], Math.PI);
		}
	});
	for (const egg of park.eggs) {
		const height =
			egg.age < 0.8
				? 0.3 +
					Math.abs(Math.cos(((egg.age / 0.8) * Math.PI) / 2)) * 3.5
				: 0.3;
		part(v, disc, 0xa5af77, [egg.x, 0.15, egg.z], [0.28, 0.008, 0.22]);
		part(
			v,
			eggShape,
			0xfff2cf,
			[egg.x, height, egg.z],
			[0.23, 0.32, 0.23],
			egg.age * 2,
			Math.sin(egg.age * 6) * 0.1
		);
	}
	return v;
}
