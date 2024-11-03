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
	// Optional properties for behavior
	acceleration?: Vector;
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
				x={p.position.x}
				y={p.position.y}
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
		() => ramp[Math.round(rng() * ramp.length)]
	).fold((a, c) => a + "" + c, "")
}


function spawnBubble(rng: () => number, max: Vector): Particle {
	return {
		id: uuid(rng),
		position: vector(
			rng() * max.x,
			rng() * max.y
		),

		mass: 0,

		radius: 5 + 10 * rng(),

		type: ParticleType.Bubble,

		acceleration: vector(0, 0),
		velocity: vector(0, 0)
	}
}

function spawnFish(rng: () => number, max: Vector): Particle {
	return {
		id: uuid(rng),
		position: vector(
			rng() * max.x,
			rng() * max.y
		),

		mass: 0,

		radius: 5 + 10 * rng(),

		type: ParticleType.Fish,

		acceleration: vector(0, 0),
		velocity: vector(0, 0)
	}
}

function spawnShark(rng: () => number, max: Vector): Particle {
	return {
		id: uuid(rng),
		position: vector(
			rng() * max.x,
			rng() * max.y
		),

		mass: 0,

		radius: 10 + 15 * rng(),

		type: ParticleType.Shark,

		acceleration: vector(0, 0),
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

function tick(_: number, p: Set<Particle>) {
	return p
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

	const onAnimationFrame = useCallback<FrameRequestCallback>(() =>
		setParticles(particles => {
			const now = performance.now();
			const dt = lastFrameTime.current.and_then(last => last - now).unwrap_or(0);

			lastFrameTime.current = Some(now);

			return tick(dt, particles)
		}), [ setParticles ]);


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

