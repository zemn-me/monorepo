"use client";

import { reduce } from 'ramda';
import { useCallback, useEffect, useRef, useState } from 'react';
import seedrandom from 'seedrandom';

import { Iterable, range } from '#root/ts/iter/index.js';
import { add, mul, Point, point, sub, x, y } from '#root/ts/math/cartesian.js';
import { fields, SimulateField, wrap2 } from '#root/ts/math/sim/sim';
import { None, Option, Some } from '#root/ts/option/option.js';
import * as date from '#root/ts/time/date.js';
import { dayOfYear } from '#root/ts/time/day_of_year.js';
import { daysInYear } from '#root/ts/time/days_in_year.js';

const a = () => date.parse([9, "oct", 2022]);

// Computes the day of the year for the target date (e.g., 9th October)
const yearlyCycleHigh = (targetDate: Date): number => dayOfYear(targetDate);

// Main function
const cyclePos = (inputDate: Date, targetDate: Date = new Date(inputDate.getFullYear(), 9 - 1, 9)): number => {
    const dayOfYearInput = dayOfYear(inputDate);
    const daysInCurrentYear = daysInYear(inputDate);
    const targetDayThisYear = yearlyCycleHigh(targetDate);

    // Calculate surrounding years' target days
    const targetDayNextYear = targetDayThisYear + daysInCurrentYear;
    const targetDayLastYear = targetDayThisYear - daysInCurrentYear;

    // Determine the closest target day
    const closestTargetDay = [targetDayLastYear, targetDayThisYear, targetDayNextYear].reduce(
        (prev, curr) => (Math.abs(curr - dayOfYearInput) < Math.abs(prev - dayOfYearInput) ? curr : prev)
    );

    // Calculate distance to the closest target date
    const distance = Math.abs(closestTargetDay - dayOfYearInput);

    // Maximum possible distance (half the year's length)
    const maxDistance = Math.floor(daysInCurrentYear / 2);

    // Normalised value
    return 1 - distance / maxDistance;
};



type Vector<N extends number = number> = Point<N>;
const vector = point;
const sum = add;
const scalar = (n: number) => vector<1>(n);


/**
 * Enum for different types of particles.
 */
enum ParticleType {
	Bubble,
	Fish,
	Shark,
	Heart,
}

/**
 * Represents a particle in the simulation.
 */
type Particle = {
	id: string;
	position: Vector<2>;
	velocity: Vector<2>;
	mass: number;
	radius: number;
	type: ParticleType;
	isBuoyant?: boolean
};



interface FishbowlProps {
	readonly particles: Set<Particle>
	readonly size: Vector<2>
}

function icon(p: Particle): string {
	switch (p.type) {
		case ParticleType.Bubble:
			return "🫧"
		case ParticleType.Heart:
			return "💕"
		case ParticleType.Fish:
			return "🐠"
		case ParticleType.Shark:
			return "🦈"
	}
}


function buoyancy(__: number, self: Particle, _: Set<Particle>): Vector<2> {
	if (!self.isBuoyant) return vector<2>(0, 0);

	return vector<2>(0, self.mass)
}

function fishFear(_: number, self: Particle, all: Set<Particle>) {
	if (self.type != ParticleType.Fish) return vector<2>(0, 0);

	const sharks = Iterable(all)
		.map(v => v.type == ParticleType.Shark ? Some(v) : None)
		.filter()
		.to_array();

	const sharkSum = Iterable(sharks)
		.fold((p, c) =>
			sum<1, 2>(
				p, c.position
			), vector<2>(0, 0));

	const sharkCentre = mul<1, 2, 1, 1>(
		sharkSum, vector<1>(1 / sharks.length)
	);

	const toward = sub<1, 2>(
		self.position, sharkCentre
	)

	const towardMag = Math.hypot(
		x(toward), y(toward)
	)

	const towardUnit = mul<1, 2, 1, 1>(
		toward, scalar(1/towardMag)
	)

	const awayUnit = mul<1, 2, 1, 1>(
		towardUnit,
		scalar(-1)
	);


	return mul<1, 2, 1, 1>(
		awayUnit,
		scalar(50)
	)
}

function sharkHunger(_: number, self: Particle, other: Set<Particle>) {
	if (self.type != ParticleType.Shark) return vector(0, 0);

	// find the nearest fish

	const distance = (other: Vector<2>) =>
		Math.hypot(x(self.position) - x(other), y(self.position), y(other));


	const closestFish = Iterable(other.difference(new Set([self])))
		.map(v => v.type == ParticleType.Fish ? Some(v) : None)
		.filter()
		.sort(
			(a, b) => distance(b.position) - distance(a.position),
		).first();

	const fishDist = closestFish.and_then(
		closest => vector<2>(
			x(self.position) - x(closest.position),
			y(self.position) - y(closest.position)
		)
	);

	const fishDir = fishDist.and_then(
		dist => {
			const mag = Math.hypot(x(dist), y(dist));

			return vector<2>(
				x(dist) / mag,
				y(dist) / mag
			)
		}
	)

	return fishDir.and_then(dir => vector<2>(
		x(dir) * 20,
		y(dir) * 20
	)).unwrap_or(vector<2>(0, 0))
}

const friction = (coefficient: number) => (__: number, self: Particle, _: Set<Particle>): Vector => vector<2>(-x(self.velocity) * coefficient * self.radius, -y(self.velocity) * coefficient * self.radius);


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
					textAnchor: "middle",
					fontSize: `${p.radius}`,
				}}
	x={x(p.position)}
	y={y(props.size) - y(p.position)}
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


function spawnBubble(rng: () => number, max: Vector<2>): Particle {

	const radius = 5 + 10 * rng();
	return {
		id: uuid(rng),
		position: vector<2>(
			rng() * x(max),
			rng() * y(max)
		),

		mass: 0.1 + radius * .5,

		radius,
		isBuoyant: true,


		type: ParticleType.Bubble,

		velocity: vector<2>(rng() * 3, rng() * 3)
	}
}

function spawnHeart(rng: () => number, max: Vector<2>): Particle {
	return {
		...spawnBubble(rng, max),
		type: ParticleType.Heart
	}
}

function spawnFish(rng: () => number, max: Vector<2>): Particle {
	const radius = 10 + 10 * rng();
	return {
		id: uuid(rng),
		position: vector<2>(
			rng() * x(max),
			rng() * y(max)
		),

		radius,
		mass: 0.1 + radius * 2,


		type: ParticleType.Fish,

		velocity: vector<2>(0, 0)
	}
}

function spawnShark(rng: () => number, max: Vector<2>): Particle {

	const radius= 15 + 15 * rng();
	return {
		id: uuid(rng),
		position: vector<2>(
			rng() * x(max),
			rng() * y(max)
		),

		mass: 1 + radius * 4,

		radius,


		type: ParticleType.Shark,

		velocity: vector<2>(0, 0)
	}
}

const ramp = "abcdefghijklmnopqrstuvwxyz".split("");

function spawnRandomBubble(rng: () => number, max: Vector<2>): Particle {
	if (rng() < ((cyclePos(a())**2))*.5) {
		return spawnHeart(rng, max)
	}

	return spawnBubble(rng, max);
}

function spawnRandomParticle(rng: () => number, max: Vector<2>): Particle {
	const rnd = rng();

	if (rnd < .1) return spawnShark(rng, max);

	if (rnd < .5) return spawnFish(rng, max);

	return spawnRandomBubble(rng, max)
}

const f1 = fields(
	buoyancy, friction(0.01)
)

const f2 = fields(
	f1,
	friction(0.01)
);

const f3 = fields(
	f2,
	sharkHunger
);

const f4 = fields(
	f3,
	fishFear
)


// im sure i can do better with
// ramda but idk how.
const field = f4;

function sim(
	dt: number,
	objects: Set<Particle>,
): Set<Particle> {
	const step = SimulateField(
		dt,
		objects,
		field
	);

	return new Set<Particle>(
		[...step].map(
			v => wrap2(
				vector<2>(0, 0),
				vector<2>(1000, 1000)
			)(v)
		)
	)
}

export function FishbowlClient() {
	const rng = seedrandom('lulu.computer');
	const size = vector<2>(1000, 1000);
	const maxDensity = (x(size) * y(size)) / 1000;
	const [particles, setParticles] = useState<Set<Particle>>(
		new Set<Particle>(
			Iterable(range(0, Math.round(rng() * maxDensity)))
				.map(() => spawnRandomParticle(rng, size))
				.value
		)
	);

	const lastFrameTime = useRef<Option<number>>(None);

	const onTick = useCallback<FrameRequestCallback>(() => {
			const now = performance.now();
			const dt = lastFrameTime.current.and_then(last => now - last).unwrap_or(0);

		lastFrameTime.current = Some(now);

		return setParticles(sim(
			dt / 1000,
			particles
		))
	}, [ particles, setParticles]);




	useEffect(() => {
		const hnd = setInterval(onTick, 1);
		return () => clearInterval(hnd);
	}, [ onTick ])


	return <Fishbowl
		particles={
			particles
		}
		size={size} />
}

