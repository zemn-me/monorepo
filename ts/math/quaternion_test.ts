import { describe, expect, test } from '@jest/globals';

import { plot2D } from '#root/ts/math/canvas/braille/braille.js';
import { point, Point2D, Point3D, x, y } from '#root/ts/math/cartesian.js';
import { cube, mesh2Edges } from '#root/ts/math/mesh/mesh.js';
import { Quaternion } from '#root/ts/math/quaternion.js'; // Adjust the import path accordingly
import { matLineToPoints } from '#root/ts/math/raster.js';
import { project } from '#root/ts/math/space/render/project.js';

const homog2cart2 = ([[px], [py], [mul]]: [[number], [number], [number]]): Point2D =>
	point<2>(px * mul, py * mul);

function renderRotatedCube(rotation: Quaternion): string {
	const focalLength = 12;
	const width = 80;
	const rotatedEdges = mesh2Edges(cube(point<3>(0, 0, 18), 4)).map(
		([start, end]) =>
			[start, end].map(vertex =>
				rotation.rotateVector(vertex)
			) as [Point3D, Point3D]
	);

	const rasterized = rotatedEdges.flatMap(([start, end]) =>
		matLineToPoints([
			homog2cart2(project(focalLength, [...start, [1]])),
			homog2cart2(project(focalLength, [...end, [1]])),
		])
	);

	return plot2D(rasterized, x, y, width);
}

describe('Quaternion arithmetic', () => {
	test('addition', () => {
		const q1 = new Quaternion(1, 2, 3, 4);
		const q2 = new Quaternion(4, 3, 2, 1);

		const result = q1.add(q2);
		expect(result.x).toBeCloseTo(5);
		expect(result.y).toBeCloseTo(5);
		expect(result.z).toBeCloseTo(5);
		expect(result.w).toBeCloseTo(5);
	});

	test('subtraction', () => {
		const q1 = new Quaternion(1, 2, 3, 4);
		const q2 = new Quaternion(4, 3, 2, 1);

		const result = q1.subtract(q2);
		expect(result.x).toBeCloseTo(-3);
		expect(result.y).toBeCloseTo(-1);
		expect(result.z).toBeCloseTo(1);
		expect(result.w).toBeCloseTo(3);
	});

	test('multiplication', () => {
		const q1 = new Quaternion(1, 2, 3, 4);
		const q2 = new Quaternion(4, 3, 2, 1);

		const result = q1.multiply(q2);
		expect(result.x).toBeCloseTo(12);
		expect(result.y).toBeCloseTo(24);
		expect(result.z).toBeCloseTo(6);
		expect(result.w).toBeCloseTo(-12);
	});

	test('normalize', () => {
		const q = new Quaternion(1, 2, 3, 4);
		const normalizedQ = q.normalize();

		const length = normalizedQ.length();
		expect(length).toBeCloseTo(1);

		const expectedNormalizedQ = new Quaternion(
			0.18257,
			0.36515,
			0.54772,
			0.7303
		);
		expect(normalizedQ.x).toBeCloseTo(expectedNormalizedQ.x, 4);
		expect(normalizedQ.y).toBeCloseTo(expectedNormalizedQ.y, 4);
		expect(normalizedQ.z).toBeCloseTo(expectedNormalizedQ.z, 4);
		expect(normalizedQ.w).toBeCloseTo(expectedNormalizedQ.w, 4);
	});

	test('fromAxisAngle ignores axis scale', () => {
		const ninetyDegrees = Math.PI / 2;
		const unitAxis = point<3>(0, 1, 0);
		const scaledAxis = point<3>(0, 5, 0);

		const fromUnit = Quaternion.fromAxisAngle(unitAxis, ninetyDegrees);
		const fromScaled = Quaternion.fromAxisAngle(scaledAxis, ninetyDegrees);

		expect(fromScaled.x).toBeCloseTo(fromUnit.x);
		expect(fromScaled.y).toBeCloseTo(fromUnit.y);
		expect(fromScaled.z).toBeCloseTo(fromUnit.z);
		expect(fromScaled.w).toBeCloseTo(fromUnit.w);
	});

	test('fromAxisAngle rejects a zero axis', () => {
		const axis = point<3>(0, 0, 0);

		expect(() => Quaternion.fromAxisAngle(axis, Math.PI / 4)).toThrow(
			'Cannot construct a quaternion from a zero-length axis.'
		);
	});

	test('renders a cube through projection and braille output in various orientations', () => {
		const orientations = [
			{
				name: 'identity',
				rotation: Quaternion.fromAxisAngle(point<3>(0, 1, 0), 0),
			},
			{
				name: 'yaw-30-pitch-20',
				rotation: Quaternion.fromAxisAngle(point<3>(0, 1, 0), Math.PI / 6)
					.multiply(Quaternion.fromAxisAngle(point<3>(1, 0, 0), Math.PI / 9))
					.normalize(),
			},
			{
				name: 'yaw-minus-35-roll-20',
				rotation: Quaternion.fromAxisAngle(point<3>(0, 1, 0), -Math.PI * 35 / 180)
					.multiply(Quaternion.fromAxisAngle(point<3>(0, 0, 1), Math.PI / 9))
					.normalize(),
			},
			{
				name: 'pitch-45-yaw-45',
				rotation: Quaternion.fromAxisAngle(point<3>(1, 0, 0), Math.PI / 4)
					.multiply(Quaternion.fromAxisAngle(point<3>(0, 1, 0), Math.PI / 4))
					.normalize(),
			},
		];

		const renders = orientations.map(({ name, rotation }) => ({
			name,
			render: renderRotatedCube(rotation),
		}));
		expect(renders).toEqual([
			{
				name: 'identity',
				render: `\
⡁⢀⠈⠀⠀⠁⠀⠀⠁⠀⠈⠀⠀⠈⠀⠀⠁⠀⠀⠁⠀⠈⠀⠀⠈⠀⠀⠁⠀⠀⠁⠀⠈⠀⠀⠁⠀⠀⡁⠈
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐
⠂⠀⠀⠀⠐⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠠
⠄⠀⠀⠀⠀⠀⠀⠄⠀⠀⠄⠀⠠⠀⠀⠄⠀⠀⠄⠀⠠⠀⠀⠠⠀⠀⠄⠀⠀⠄⠀⠠⠠⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈
⠁⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠐
⠂⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠀⠀⠀⠀⠀⠀⢀
⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈
⠁⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠠
⠂⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠀⠀⠀⠀⠀⠀⢀
⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐
⠁⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠠
⠄⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀
⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠈
⠀⠀⠀⠀⠀⠀⠀⠂⠂⠀⠐⠀⠀⠐⠀⠀⠂⠀⠀⠂⠀⠐⠀⠀⠐⠀⠀⠂⠀⠐⠀⠀⠐⠀⠀⠀⠀⠀⠀⠐
⠂⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠠
⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⡀⢈⠀⠀⢀⠀⠀⡀⠀⠀⡀⠀⢀⠀⠀⡀⠀⠀⡀⠀⢀⠀⠀⢀⠀⠀⡀⠀⠀⡀⠀⢀⠀⠀⢀⠀⠀⡀⠁⢈`.trim(),
			},
			{
				name: 'yaw-30-pitch-20',
				render: `\
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠐⠨⠐⠠⢀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠄⠀⠀⠡⠀⠀⠈⠠⢀⡀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠄⠁⠀⠀⠀⠈⠄⠀⠀⠄⠐⠐⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠈⠀⠀⠀⠀⠀⠀⡨⠄⠁⠀⠀⠀⠡⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡌⠀⠀⠀⠀⠀⠀⡀⠂⠀⠡⠀⠀⠀⠀⠀⠁⠄⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢂⠁⠂⡀⠀⠄⠂⠀⠀⠀⢈⢄⢀⢀⠀⠀⠀⠈⠄
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡂⠀⠀⠡⠀⠀⡀⠠⠐⠀⠀⠀⠀⠈⠈⢈⠰⠘
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⠀⡀⠅⠆⠀⠀⠀⠀⡀⠠⠐⠐⠈⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠄⠅⠄⠄⠌⠄⠄⠂⠁⠀⠀⠀⠀⠀⠀⠀⠀`.trim(),
			},
			{
				name: 'yaw-minus-35-roll-20',
				render: `\
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠄⢄⢀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⢀⠂⠀⠐⠀⠄⢁⠐⠀⠂⠠⢀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠠⠀⠀⠀⠀⠀⠀⠀⠢⠀⠄⠠⢀⠀⡈⢐⠀⠂⠠⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠐⠀⠀⠀⠀⠀⠀⠀⡁⠀⠀⠀⠀⠀⠀⠀⠀⡁⠁⠈⠀⠃⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠌⠀⠀⠀⠀⠀⠀⠠⠀⠀⠀⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⢀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠂⠀⠀⠀⠀⠀⠀⡈⠀⠀⠀⠀⠀⠀⠀⠀⢀⠁⠀⠀⠀⠐⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠅⠀⠀⠀⠀⠀⠀⠄⢀⠀⡀⡀⠠⠀⠄⠠⠠⠀⠀⠀⢀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠖⠐⠀⠁⠈⠀⢑⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠄⠀⠐⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠂⡀⠀⠀⠀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠂⡁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠄⠀⠐⠀⠀⠀⠀⠀⠀⠀⡀⡀⠠⠀⠂⠐⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠂⡌⡀⠠⠀⠄⠂⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`.trim(),
			},
			{
				name: 'pitch-45-yaw-45',
				render: `\
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠍⠈⠀⠁⠈⠈⡀⠃⢁⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠀⠀⡂⠀⠀⡀⠐⠀⠀⠀⠐⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠄⠈⠀⠀⠠⢀⠀⠂⠀⠀⠀⠀⠀⠀⠅
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠄⡈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠌⠄⠠⠠⠀⠁⠠⠆⠄⠠⠠⠀⠄⠄⠠⠠⢀⠬
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠂⠀⠀⠀⡀⠅⠈⠀⠀⠀⠀⠀⠀⠀⡀⠂⠈⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠀⡀⠐⠀⠀⠐⡀⠀⠀⠀⠄⠐⠈⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⠁⠅⠄⠠⠀⠄⠄⠠⠐⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀`.trim(),
			},
		]);
	});
});
