import * as Vec from '@zemn.me/math/vec'

export interface Particle<D extends number = number> {
	/**
	 * kg
	 */
	mass: number

	/**
	 * m/s
	 */
	speed: Vec.Vector<D>

	/**
	 * m
	 */
	displacement: Vec.Vector<D>
}

export type Force<D extends number = number> = Vec.Vector<D>

export type Field<D extends number = number> = (
	particle: Particle<number>,
	globalTime: number,
) => Force<D>

export const Gravity: Field<number> = ({ mass }) => [0, -mass * 10] as const

/**
 * @param force (particle) => kg * m/s/s
 * @param time seconds
 */
export const simulate: <D extends number>(

	p: Readonly<Particle<D>>,
	timeDelta: number,
	...fields: Field<D>[]
) => Particle<D> = (particle, timeDelta, ...fields) => {
	const [firstForce, ...otherForces] = fields.map((f) =>
		f(particle, timeDelta),
	)
	const resultantForce = otherForces.reduce(
		(a, c) => Vec.add(a, c),
		firstForce,
	)

	let acc = Vec.div(resultantForce, particle.mass)

	let dx // change in displacement
	const v0 = particle.speed
	const a = acc
	const t = timeDelta

	const timeTravelledDueToExtantSpeed = Vec.mul(t, v0)
	const timeTravelledDuetoAccel = Vec.mul(0.5 * Math.pow(t, 2), a)
	const increaseInSpeed = Vec.mul(t, acc)

	dx = Vec.add(timeTravelledDueToExtantSpeed, timeTravelledDuetoAccel)


	const newDisplacement = Vec.add(particle.displacement, dx)
	const newSpeed = Vec.add(particle.speed, increaseInSpeed)

	return {
		...{
			displacement: particle.displacement,
			mass: particle.mass,
			speed: particle.speed,
		},
		displacement: newDisplacement,
		speed: newSpeed,
	}
}
