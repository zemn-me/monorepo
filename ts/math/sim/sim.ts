/**
 * @fileoverview
 * Functions for a simulation in time.
 */

import { Iterable } from "#root/ts/iter/index.js"
import { add, mul, Point, point, x, y, z } from "#root/ts/math/cartesian.js"


type Vector<N extends number = number> = Point<N>;
const vector = point;
const sum = add;
const scalar = (n: number) => vector<1>(n);

export const kilogram = 1;

/**
 * Performs operations on an object in the simulation
 * on a tick-to-tick basis.
 */
export interface TickField<T> {
	(dt: number, self: T, other: Set<T>): T
}

/**
 * Resolve forces on an object in the simulation
 */
export interface Field<T, N extends number> {
	(dt: number, self: T, other: Set<T>): Vector<N>
}


export const forceField =
	<N extends number>(unitVector:
		Vector<N>
	) =>
		(force: number): Field<unknown, N> =>
			() => mul<1, N, 1, 1>(unitVector,
				scalar(force)
			);

export const airFriction =
	<N extends number>(coefficient: Vector<1>): Field<Particle<N>, N> =>
	(_: number, self: Particle<N>, __: Set<Particle<N>>) => mul<1, N, 1, 1>(mul<1, N, 1, 1>(self.velocity, scalar(-1)), coefficient)

export const earthGravity: Field<unknown, 3> =
	forceField<3>(
		vector<3>(0, 0, -1)
	)(10);

/**
 * if value is -1, return max-1,
 * if value is max+1, return 1 usw.
 */
function wrapToZero(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function wrapInRange(value: number, minVal: number, maxVal: number): number {
  const span = (maxVal - minVal) + 1;
  return wrapToZero(value - minVal, span) + minVal;
}

/**
 * Simulates a plane at Y=0 that objects collide with elasically.
 */
export const collisionPlaneZ0:
	Field<
		Massed &
		Velocitied<3> &
		Positioned<3>,
		3
	> =
	(dt, self, __) => {
		if (z(self.position) > 0) return vector<3>(0, 0, 0);

		// exert a force within DT which
		// effectively reverses the
		// particle's velocity
		//
		// f = ma
		// v = at
		// v2 = v1 + at
		// v2 - v1 = at
		// (v2-v1) /t = a
		//
		// f = m(
		// (v2-v1) /t
		// )
		//

		const f = self.mass * (
			(
				(-z(self.velocity)) -
				z(self.velocity)
			) / dt
		)



		return vector<3>(
			x(self.velocity),
			y(self.velocity),
			f
		)
	}

/**
 * When the particle exits some bounds, wrap it
 * around to the other side.
 *
 * im lazy so its only for 2d rn
 */
export const wrap2 = (min: Vector<2>, max: Vector<2>) => <T extends Particle<2>>(self: T): T => {
	self.position = vector<2>(
		wrapInRange(
			x(self.position),
			x(min),
			x(max)
		),
		wrapInRange(
			y(self.position),
			y(min),
			y(max)
		)
	);

	return self;
}

/**
 * Combine two fields into a single Field.
 */
export function fields<T1, T2, N extends number>(
	f1: Field<T1, N>,
	f2: Field<T2, N>
): Field<T1 & T2, N> {
	return (...a: Parameters<Field<T1 & T2, N>>) =>
		sum<1, N>(f1(...a), f2(...a))
}

export interface Massed {
	mass: number
}

export interface Velocitied<N extends number> {
	velocity: Vector<N>
}

export interface Positioned<N extends number> {
	position: Vector<N>
}

type Particle<N extends number> =
	Massed & Velocitied<N> & Positioned<N>


export function SimulateField<N extends number, T extends Particle<N>>(
	dt: number,
	objects: Set<T>,
	field: Field<T, N>
): Set<T> {
	return new Set(Iterable(objects).map(self => {
		const other = objects.difference(
			new Set([self])
		);

		const force = field(dt, self, other);

		const acc = mul<1, N, 1, 1>(
			force,
			scalar(1/self.mass)
		)

		const dv = mul<1, N, 1, 1>(
			acc,
			scalar(dt)
		);

		const dp = mul<1, N, 1, 1>(
			self.velocity,
			scalar(dt)
		);

		self.velocity = sum<1, N>(
			self.velocity,
			dv
		);

		self.position = sum<1, N>(
			self.position,
			dp
		);

		return self;
	}).to_array())
}

