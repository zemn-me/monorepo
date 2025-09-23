import * as Cartesian from "#root/ts/math/cartesian.js";
import { map } from "#root/ts/math/vec.js";
import { Tuple, TupleIndex } from "#root/ts/tuple.js";

export const Verticies = Symbol();
export const Edges = Symbol();
export const Centre = Symbol();

/**
 * A mesh structure represented by a set of verticies (points),
 * and a number of connections between those points (edges).
 */
export interface Mesh<N extends number = number> {
	/**
	 * A set of points in space that may be connected by edges.
	 */
	[Verticies]: Tuple<Cartesian.Point3D, N>;
	/**
	 * A set of connections between verticies.
	 *
	 * Each edge is a 2-tuple of two verticies in the verticies
	 * array.
	 */
	[Edges]: Tuple<
		TupleIndex<N>
		, 2>[];

	[Centre]: Cartesian.Point3D
}

export function mesh2Edges<N extends number>(m: Mesh<N>) {
	return map(m[Edges], ([start, end]) =>
		[m[Verticies][start], m[Verticies][end]] as const
	)
}

export const mesh2Lines = mesh2Edges;

const defaultCentre: Cartesian.Point3D =
	Cartesian.point<3>(0, 0, 0);

/**
 * Creates a cube about 0, 0, 0 with the given
 * radius.
 */
export const cube = (
	radius: number
): Mesh<8> => ({
	[Centre]: defaultCentre,
	[Verticies]: [
		Cartesian.point<3>(
			Cartesian.x(defaultCentre) - radius,
			Cartesian.y(defaultCentre) - radius,
			Cartesian.z(defaultCentre) - radius
		),
		Cartesian.point<3>(
			Cartesian.x(defaultCentre) + radius,
			Cartesian.y(defaultCentre) - radius,
			Cartesian.z(defaultCentre) - radius
		),
		Cartesian.point<3>(
			Cartesian.x(defaultCentre) + radius,
			Cartesian.y(defaultCentre) + radius,
			Cartesian.z(defaultCentre) - radius
		),
		Cartesian.point<3>(
			Cartesian.x(defaultCentre) - radius,
			Cartesian.y(defaultCentre) + radius,
			Cartesian.z(defaultCentre) - radius
		),
		Cartesian.point<3>(
			Cartesian.x(defaultCentre) - radius,
			Cartesian.y(defaultCentre) - radius,
			Cartesian.z(defaultCentre) + radius
		),
		Cartesian.point<3>(
			Cartesian.x(defaultCentre) + radius,
			Cartesian.y(defaultCentre) - radius,
			Cartesian.z(defaultCentre) + radius
		),
		Cartesian.point<3>(
			Cartesian.x(defaultCentre) + radius,
			Cartesian.y(defaultCentre) + radius,
			Cartesian.z(defaultCentre) + radius
		),
		Cartesian.point<3>(
			Cartesian.x(defaultCentre) - radius,
			Cartesian.y(defaultCentre) + radius,
			Cartesian.z(defaultCentre) + radius
		),
	],
	[Edges]: [
		[0, 1],
		[1, 2],
		[2, 3],
		[3, 0],
		[4, 5],
		[5, 6],
		[6, 7],
		[7, 4],
		[0, 4],
		[1, 5],
		[2, 6],
		[3, 7]
	]
});


export const translateMesh =
	(by: Cartesian.Point3D) =>
	<N extends number>(
		m: Mesh<N>
	): Mesh<N> => ({
		...m,
		[Centre]:
			Cartesian.add<3>(
				by,
				m[Centre]
			),

		[Verticies]:
			map(
				m[Verticies],
				v => Cartesian.add<3>(
					by,
					v
				),
			)
	})
