/**
 * @fileoverview
 * Functions for a simulation in time.
 */

import { Iterable } from "#root/ts/iter/index.js"
import { Point, point } from "#root/ts/math/cartesian.js"

type Vector<N extends number = number> = Point<N>;
const vector = point;


/**
 * Performs operations on an object in the simulation
 * on a tick-to-tick basis.
 */
export interface TickField<T> {
	(dt: number, self: T, other: Set<T>): T
}


export interface Particle<N extends number> {
	mass: number,
	velocity: Vector<N>
}

/**
 * Resolve forces on an object in the simulation
 */
export interface Field<T, N extends number> {
	(dt: number, self:T, other: Set<T>): Vector<N>
}


function SimulateFields<T, N extends number>(
	dt: number,
	objects: Set<T>,
	fields: Set<Field<T, N>>
): Set<T> {
	return new Set(Iterable(objects).map(self => {
		const force = Iterable(fields).map(field =>
			field(dt, self, objects.difference(
				new Set([self])
			))
		// this needs to be fixed for variable N
		).fold((a, b) => vector(x(a) + x(b), a.y + b.y), vector(0, 0));

		const acceleration = vector(
			force.x / self.mass,
			force.y / self.mass
		);

		const dv = vector(
			acceleration.x * dt,
			acceleration.y * dt
		);

		self.velocity = vector(
			self.velocity.x + dv.x,
			self.velocity.y + dv.y
		);

		self.position = vector(
			(self.position.x + self.velocity.x * dt) % bounds.max.x,
			(self.position.y + self.velocity.y * dt) % bounds.max.y
		)

		if (self.position.x < 0) {
			self.position.x += bounds.max.x
		}

		if (self.position.y < 0) {
			self.position.y += bounds.max.y
		}

		return self;
	}).to_array())
}
