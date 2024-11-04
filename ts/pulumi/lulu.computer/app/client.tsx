"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import seedrandom from 'seedrandom';

import { Iterable, range } from '#root/ts/iter/index.js';
import { None, Option, Some } from '#root/ts/option/option.js';


export type Vector = { x: number; y: number };

export const vector = (x: number, y: number): Vector => ({ x, y });

/**
 * Enum for different types of particles.
 */
enum ParticleType {
	Bubble,
	Fish,
	Shark,
}

/**
 * Represents a particle in the simulation.
 */
type Particle = {
	id: string;
	position: Vector;
	velocity: Vector;
	mass: number;
	radius: number;
	type: ParticleType;
};



interface FishbowlProps {
	readonly particles: Set<Particle>
	readonly size: Vector
}

function icon(p: Particle): string {
	switch (p.type) {
		case ParticleType.Bubble:
			return "🫧"
		case ParticleType.Fish:
			return "🐠"
		case ParticleType.Shark:
			return "🦈"
	}
}

interface FieldEffect {
	(self: Particle, all: Set<Particle>, δt: number): Vector
}

function buoyancy(self: Particle, _: Set<Particle>, __: number): Vector {
	if (self.type != ParticleType.Bubble) return vector(0, 0);

	return vector(0, self.mass)
}

function fishFear(self: Particle, all: Set<Particle>, dt: number) {
	if (self.type != ParticleType.Fish) return vector(0, 0);

	const sharks = Iterable(all)
		.map(v => v.type == ParticleType.Shark ? Some(v) : None)
		.filter()
		.to_array();

	const sharkSum = Iterable(sharks)
		.fold((p, c) => vector(
			p.x + c.position.x,
			p.y + c.position.y
		), vector(0, 0));

	const sharkCentre = vector(
		sharkSum.x / sharks.length,
		sharkSum.y / sharks.length
	)

	const toward = vector(
		self.position.x - sharkCentre.x,
		self.position.y - sharkCentre.y
	);

	const towardMag = Math.hypot(toward.x, toward.y);

	const towardUnit = vector(
		toward.x / towardMag,
		toward.y / towardMag
	);

	const awayUnit = vector(
		-towardUnit.x,
		-towardUnit.y
	);

	return vector(
		awayUnit.x * 50 * dt,
		awayUnit.y * 50 * dt
	)


}

function sharkHunger(self: Particle, other: Set<Particle>, dt: number) {
	if (self.type != ParticleType.Shark) return vector(0, 0);

	// find the nearest fish

	const distance = (other: Vector) =>
		Math.hypot(self.position.x - other.x, self.position.y, other.y);


	const closestFish = Iterable(other.difference(new Set([self])))
		.map(v => v.type == ParticleType.Fish ? Some(v) : None)
		.filter()
		.sort(
			(a, b) => distance(b.position) - distance(a.position),
		).first();

	const fishDist = closestFish.and_then(
		closest => vector(
			self.position.x - closest.position.x,
			self.position.y - closest.position.y
		)
	)

	const fishDir = fishDist.and_then(
		dist => {
			const mag = Math.hypot(dist.x, dist.y);

			return vector(
				dist.x / mag,
				dist.y / mag
			)
		}
	)


	return fishDir.and_then(dir => vector(
		dir.x * clamp(dt, 1) * 1000,
		dir.y * clamp(dt, 1) * 1000
	)).unwrap_or(vector(0, 0))
}

function clamp(v: number, vmax: number) {
	if (v < vmax) return v;
	return vmax;
}

const friction = (coefficient: number) => (self: Particle, _: Set<Particle>, __: number): Vector => vector(-self.velocity.x * coefficient * self.radius, -self.velocity.y * coefficient * self.radius);


function Fishbowl(props: FishbowlProps) {
	return <svg style={{
		width: "100vw",
		height: "100vh"
	}}
	>
		<rect fill="url(#underwaterGradient)" height="100%" width="100%" />

		{
			Iterable(props.particles).map(p => <text
				key={p.id}
				style={{
					fontSize: `${p.radius}`
				}}
				transform={
		p.velocity.x > 0
			? `translate(${p.position.x}, ${props.size.y - p.position.y}) scale(-1, 1) translate(${-p.position.x}, 0)`
			: `translate(${p.position.x}, ${props.size.y - p.position.y})`
	}
	x={0}
	y={0}
			>{
					icon(p)
				}</text>).to_array()
		}



		<defs>
			<linearGradient id="underwaterGradient" x1="0%" x2="0%" y1="0%" y2="100%">
				<stop offset="0%" style={{ stopColor: '#0d47a1', stopOpacity: 1 }} /> {/* Dark blue */}
				<stop offset="50%" style={{ stopColor: '#1976d2', stopOpacity: 1 }} /> {/* Medium blue */}
				<stop offset="75%" style={{ stopColor: '#4fc3f7', stopOpacity: 1 }} /> {/* Light blue */}
				<stop offset="100%" style={{ stopColor: '#81d4fa', stopOpacity: 1 }} /> {/* Lighter blue */}
			</linearGradient>
		</defs>


	</svg>
}


function uuid(rng: () => number) {
	return Iterable(range(0, 10)).map(
		() => ramp[Math.floor(rng() * ramp.length)]
	).fold((a, c) => a + "" + c, "")
}


function spawnBubble(rng: () => number, max: Vector): Particle {

	const radius = 5 + 10 * rng();
	return {
		id: uuid(rng),
		position: vector(
			rng() * max.x,
			rng() * max.y
		),

		mass: 0.1 + radius * .5,

		radius,


		type: ParticleType.Bubble,

		velocity: vector(rng() * 3, rng() * 3)
	}
}

function spawnFish(rng: () => number, max: Vector): Particle {
	const radius = 10 + 10 * rng();
	return {
		id: uuid(rng),
		position: vector(
			rng() * max.x,
			rng() * max.y
		),

		radius,
		mass: 0.1 + radius * 2,


		type: ParticleType.Fish,

		velocity: vector(0, 0)
	}
}

function spawnShark(rng: () => number, max: Vector): Particle {

	const radius= 15 + 15 * rng();
	return {
		id: uuid(rng),
		position: vector(
			rng() * max.x,
			rng() * max.y
		),

		mass: 1 + radius * 4,

		radius,


		type: ParticleType.Shark,

		velocity: vector(0, 0)
	}
}

const ramp = "abcdefghijklmnopqrstuvwxyz".split("");

function spawnRandomParticle(rng: () => number, max: Vector): Particle {
	const rnd = rng();

	if (rnd < .1) return spawnShark(rng, max);

	if (rnd < .5) return spawnFish(rng, max);

	return spawnBubble(rng, max)

}

const fields: FieldEffect[] = [
	buoyancy,
	friction(0.01),
	sharkHunger,
	fishFear
];

interface Range {
	min: Vector,
	max: Vector
}

function tick(dt: number, p: Set<Particle>, bounds: Range) {
	return new Set(Iterable(p).map(self => {
		const force = Iterable(fields).map(field =>
			field(self, p, dt)
		).fold((a, b) => vector(a.x + b.x, a.y + b.y), vector(0, 0));

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

export function FishbowlClient() {
	const rng = seedrandom('lulu.computer');
	const size = vector(1000, 1000);
	const maxDensity = (size.x * size.y) / 1000;
	const [particles, setParticles] = useState<Set<Particle>>(
		new Set<Particle>(
			Iterable(range(0, Math.round(rng() * maxDensity)))
				.map(() => spawnRandomParticle(rng, size))
				.value
		)
	);

	const lastFrameTime = useRef<Option<number>>(None);
	const animationframeRequestHnd = useRef<Option<number>>(None);

	const onAnimationFrame = useCallback<FrameRequestCallback>(() => {
			const now = performance.now();
		const dt = lastFrameTime.current.and_then(last => now - last).unwrap_or(0);

		lastFrameTime.current = Some(now);

		animationframeRequestHnd.current = Some(
			requestAnimationFrame(onAnimationFrame)
		)

		return setParticles(tick(dt / 1000, particles, {
			min: vector(0, 0),
			max: size,
		}));
		}, [ particles, setParticles]);


	useEffect(() => {
		animationframeRequestHnd.current = Some(requestAnimationFrame(
			onAnimationFrame
		));

		return () => void animationframeRequestHnd.current.and_then(hnd =>
			cancelAnimationFrame(hnd)
		 )
	}, [ onAnimationFrame])


	return <Fishbowl
		particles={
			particles
		}
		size={size} />
}

