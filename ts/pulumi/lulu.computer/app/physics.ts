import { Set } from 'immutable';

import { add, div, magnitude, sub, Vector } from '#root/ts/math/vec.js';

type Force = Vector<2>;
type Acceleration = Vector<2>;
type Velocity = Vector<2>;
type Position = Vector<2>;


type Property<I, P> = [get: (i: I) => P, set: (i: I, v: P) => I];

const x: Property<Vector<2>, number> = [
	v => v[0],
	(v, n) => [n, v[1]]
];

const y: Property<Vector<2>, number> = [
	v => v[1],
	(v, n) => [v[0], n]
]

function get<I, P>(p: Property<I, P>) {
	return p[0]
}

function set<I, P>(p: Property<I, P>) {
	return p[1]
}

interface FieldEffect<P> {
	(self: P, other: Set<P>, dt: number): Force;
}

export function fields<P1, P2>(f1: FieldEffect<P1>, f2: FieldEffect<P2>):
	FieldEffect<P1 & P2> {

	return (p: P1 & P2, ...a) => add<2>(f1(p, ...a), f2(p, ...a))
}


interface SimulationStep<P> {
	(self: P, other: Set<P>, dt: number): P
}

export function simSteps<P1, P2>(s1: SimulationStep<P1&P2>, s2: SimulationStep<P1&P2>):
	SimulationStep<P1 & P2> {

	return (p: P1 & P2, ...args) =>
		s2(s1(p, ...args), ...args)
}

export const simulateForces = <P>(
	Velocity: Property<P, Velocity>,
	Mass: Property<P, number>,
	Position: Property<P, Position>,
	forces: FieldEffect<P>
) => (self: P, other: Set<P>, dt: number) => {
	const f = forces(self, other, dt);

	const acceleration = [x, y].reduce(
		(v, axis) =>
			set(axis)(v, get(axis)(f) / get(Mass)(self)),
		[NaN, NaN] as Acceleration
	)

	const dv = [x, y].reduce(
		(v, axis) => set(axis)(
			v, get(axis)(acceleration) * dt
		),
		[NaN, NaN] as Velocity
	)

	const velocity = add<2>(get(Velocity)(self), dv);

	const dPos = [x, y].reduce(
		(v, axis) => set(axis)(
			v, get(axis)(velocity) * dt
		)
		, [NaN, NaN] as Position
	)

	const position = add<2>(get(Position)(self), dPos);


	self = set(Velocity)(self, velocity);
	self = set(Position)(self, position);
}

const distance = (
	p1: Position,
	p2: Position
): number => magnitude(sub(p1, p2))

const contains = <P>(
	Position: Property<P, Position>,
) => (
	minX: number,
	minY: number,
	maxX: number,
	maxY: number
) => (v: P) =>
			([
				[x, minX, maxX],
				[y, minY, maxY]
			] as const).every(
				([axis, min, max]) =>
					get(axis)(get(Position)(v)) > min &&
					get(axis)(get(Position)(v)) < max
			);

const midPoint = (p1: Position, p2: Position): Position =>
	div<2>(2, add<2>(p1, p2));

/**
 * A forcefield which pushes particles into
 * a given viewport.
 */
export const viewportForce = <P>(
	Position: Property<P, Position>
) => (
	minX: number,
	minY: number,
	maxX: number,
	maxY: number,
) => (
	/**
	 * The opposing force exerted on particles
	 * based on their distance from the centre
	 * of the viewport.
	 *
	 * the force is exerted along a line through the
	 * centre of the viewport.
	 */
	scale: (distance: number) => number
) => (self: P, _: Set<P>, dt: number): Force =>
	contains(Position)(
	 minX, minY, maxX, maxY
 )(self)?[0, 0]:

	[x, y].reduce(
		(v, axis) => [x, y].map(
			scale(
				get(axis)(get(Position)(self)) -

		)
	, [NaN, NaN] as Force
)

export function simulate<P>(
	particles: Set<P>,
	resultantForces: FieldEffect<P>,
	speed: Property<P, Vector<2>>,
	mass: Property<P, number>,
	dt: number,
): Set<P> {

}
