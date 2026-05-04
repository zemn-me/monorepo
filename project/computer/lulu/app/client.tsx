'use client';

import { useEffect, useRef, useState } from 'react';
import seedrandom from 'seedrandom';

import {
	type AquariumParticleProjection,
	CAMERA_ORBIT_RADIANS_PER_SECOND,
	projectAquariumParticle,
	renderAquariumScene,
} from '#root/project/computer/lulu/scene.js';
import {
	filter,
	first,
	fold,
	iterator,
	map,
	range,
	to_array,
	to_set,
} from '#root/ts/iter/iterable_functional.js';
import { add, mul, Point, point, sub, x, y } from '#root/ts/math/cartesian.js';
import { fields, SimulateField, wrap2 } from '#root/ts/math/sim/sim.js';
import { and_then, None, Some, unwrap_or } from '#root/ts/option/types.js';
import * as date from '#root/ts/time/date.js';
import { dayOfYear } from '#root/ts/time/day_of_year.js';
import { daysInYear } from '#root/ts/time/days_in_year.js';

const a = () => date.parse([9, 'oct', 2022]);

// Computes the day of the year for the target date (e.g., 9th October)
const yearlyCycleHigh = (targetDate: Date): number => dayOfYear(targetDate);

// Main function
const cyclePos = (
	inputDate: Date,
	targetDate: Date = new Date(inputDate.getFullYear(), 9 - 1, 9)
): number => {
	const dayOfYearInput = dayOfYear(inputDate);
	const daysInCurrentYear = daysInYear(inputDate);
	const targetDayThisYear = yearlyCycleHigh(targetDate);

	// Calculate surrounding years' target days
	const targetDayNextYear = targetDayThisYear + daysInCurrentYear;
	const targetDayLastYear = targetDayThisYear - daysInCurrentYear;

	// Determine the closest target day
	const closestTargetDay = [
		targetDayLastYear,
		targetDayThisYear,
		targetDayNextYear,
	].reduce((prev, curr) =>
		Math.abs(curr - dayOfYearInput) < Math.abs(prev - dayOfYearInput)
			? curr
			: prev
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
	isBuoyant?: boolean;
};

interface FishbowlProps {
	readonly particles: Set<Particle>;
	readonly size: Vector<2>;
	readonly cameraAngle: number;
}

interface ViewportSize {
	readonly width: number;
	readonly height: number;
}

const defaultViewportSize: ViewportSize = {
	width: 1200,
	height: 800,
};

function viewportSizeFromWindow(): ViewportSize {
	return {
		width: Math.max(1, Math.round(window.innerWidth)),
		height: Math.max(1, Math.round(window.innerHeight)),
	};
}

function icon(p: Particle): string {
	switch (p.type) {
		case ParticleType.Bubble:
			return '🫧';
		case ParticleType.Heart:
			return '💕';
		case ParticleType.Fish:
			return '🐠';
		case ParticleType.Shark:
			return '🦈';
	}
}

function buoyancy(__: number, self: Particle, _: Set<Particle>): Vector<2> {
	if (!self.isBuoyant) return vector<2>(0, 0);

	return vector<2>(0, self.mass);
}

function fishFear(_: number, self: Particle, all: Set<Particle>) {
	if (self.type != ParticleType.Fish) return vector<2>(0, 0);

	// i guess we are doing this shit until the pipeline
	// operator exists

	const s1 = map(all, v => (v.type == ParticleType.Shark ? Some(v) : None));

	const s2 = filter(s1);

	const sharks = to_set(s2);

	/**
	 * positions of all the sharks added together
	 */
	const sharkSum = fold((p: Vector<2>, c: Particle) =>
		sum<1, 2>(p, c.position)
	)(vector<2>(0, 0))(sharks);

	/**
	 * average position of all the sharks
	 */
	const sharkCentre = mul<1, 2, 1, 1>(sharkSum, vector<1>(1 / sharks.size));

	const toward = sub<1, 2>(self.position, sharkCentre);

	const towardMag = Math.hypot(x(toward), y(toward));

	const towardUnit = mul<1, 2, 1, 1>(toward, scalar(1 / towardMag));

	const awayUnit = mul<1, 2, 1, 1>(towardUnit, scalar(-1));

	return mul<1, 2, 1, 1>(awayUnit, scalar(50));
}

function sharkHunger(_: number, self: Particle, other: Set<Particle>) {
	if (self.type != ParticleType.Shark) return vector(0, 0);

	// find the nearest fish

	const distance = (other: Vector<2>) =>
		Math.hypot(x(self.position) - x(other), y(self.position), y(other));

	// closestFish
	const maybeFish = map(other.difference(new Set([self])), (v: Particle) =>
		v.type == ParticleType.Fish ? Some(v) : None
	);

	const fishes = filter(maybeFish);

	const fishes_by_closeness = to_array(fishes).sort(
		(a, b) => distance(b.position) - distance(a.position)
	);

	const closestFish = first(iterator(fishes_by_closeness));

	const fishDist = and_then(closestFish, closest =>
		vector<2>(
			x(self.position) - x(closest.position),
			y(self.position) - y(closest.position)
		)
	);

	/**
	 * Direction to nearest fish.
	 */
	const fishDir = and_then(fishDist, dist => {
		const mag = Math.hypot(x(dist), y(dist));

		return vector<2>(x(dist) / mag, y(dist) / mag);
	});

	return unwrap_or(
		and_then(fishDir, dir => vector<2>(x(dir) * 20, y(dir) * 20)),
		vector<2>(0, 0)
	);
}

const friction =
	(coefficient: number) =>
	(__: number, self: Particle, _: Set<Particle>): Vector =>
		vector<2>(
			-x(self.velocity) * coefficient * self.radius,
			-y(self.velocity) * coefficient * self.radius
		);

function Fishbowl(props: FishbowlProps) {
	const [viewportSize, setViewportSize] =
		useState<ViewportSize>(defaultViewportSize);

	useEffect(() => {
		function syncViewportSize() {
			const next = viewportSizeFromWindow();
			setViewportSize(current =>
				current.width === next.width && current.height === next.height
					? current
					: next
			);
		}

		syncViewportSize();
		window.addEventListener('resize', syncViewportSize);

		return () => {
			window.removeEventListener('resize', syncViewportSize);
		};
	}, []);

	const scene = renderAquariumScene(
		props.cameraAngle,
		viewportSize.width,
		viewportSize.height
	);
	const renderedParticles = to_array(props.particles)
		.map(particle => ({
			particle,
			projection: projectAquariumParticle(
				particle.id,
				particle.position,
				particle.radius,
				props.size,
				scene.pose,
				viewportSize.width,
				viewportSize.height
			),
		}))
		.filter(
			(
				rendered
			): rendered is {
				readonly particle: Particle;
				readonly projection: AquariumParticleProjection;
			} => rendered.projection != null
		)
		.sort((left, right) => right.projection.depth - left.projection.depth);

	return (
		<svg
			aria-label="lulu.computer aquarium"
			role="img"
			viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
			style={{
				width: '100vw',
				height: '100vh',
				display: 'block',
				background: '#071923',
			}}
		>
			<rect
				fill="url(#underwaterGradient)"
				height={viewportSize.height}
				width={viewportSize.width}
			/>

			{scene.faces.map(face => (
				<polygon
					key={face.key}
					fill={face.fill}
					opacity={face.opacity}
					points={face.points}
				/>
			))}

			{renderedParticles.map(({ particle, projection }) => (
				<text
					key={particle.id}
					dominantBaseline="central"
					filter="url(#particleGlow)"
					opacity={projection.opacity}
					style={{
						textAnchor: 'middle',
						fontSize: `${projection.fontSize}px`,
					}}
					x={projection.x}
					y={projection.y}
				>
					{icon(particle)}
				</text>
			))}

			{scene.segments.map((segment, index) => (
				<line
					key={index}
					opacity={segment.opacity}
					stroke={segment.stroke}
					strokeLinecap="round"
					strokeWidth={segment.width}
					x1={segment.x1}
					x2={segment.x2}
					y1={segment.y1}
					y2={segment.y2}
				/>
			))}

			<defs>
				<linearGradient
					id="underwaterGradient"
					x1="0%"
					x2="0%"
					y1="0%"
					y2="100%"
				>
					<stop
						offset="0%"
						style={{ stopColor: '#05151e', stopOpacity: 1 }}
					/>
					<stop
						offset="42%"
						style={{ stopColor: '#0f4050', stopOpacity: 1 }}
					/>
					<stop
						offset="72%"
						style={{ stopColor: '#176777', stopOpacity: 1 }}
					/>
					<stop
						offset="100%"
						style={{ stopColor: '#486b4f', stopOpacity: 1 }}
					/>
				</linearGradient>
				<filter
					id="particleGlow"
					x="-40%"
					y="-40%"
					width="180%"
					height="180%"
				>
					<feDropShadow
						dx="0"
						dy="0"
						floodColor="#bff8ff"
						floodOpacity="0.42"
						stdDeviation="1.6"
					/>
				</filter>
			</defs>
		</svg>
	);
}

function uuid(rng: () => number) {
	const bits = map(range(0, 10), () => ramp[Math.floor(rng() * ramp.length)]);
	return to_array(bits).join('');
}

function spawnBubble(rng: () => number, max: Vector<2>): Particle {
	const radius = 5 + 10 * rng();
	return {
		id: uuid(rng),
		position: vector<2>(rng() * x(max), rng() * y(max)),

		mass: 0.1 + radius * 0.5,

		radius,
		isBuoyant: true,

		type: ParticleType.Bubble,

		velocity: vector<2>(rng() * 3, rng() * 3),
	};
}

function spawnHeart(rng: () => number, max: Vector<2>): Particle {
	return {
		...spawnBubble(rng, max),
		type: ParticleType.Heart,
	};
}

function spawnFish(rng: () => number, max: Vector<2>): Particle {
	const radius = 10 + 10 * rng();
	return {
		id: uuid(rng),
		position: vector<2>(rng() * x(max), rng() * y(max)),

		radius,
		mass: 0.1 + radius * 2,

		type: ParticleType.Fish,

		velocity: vector<2>(0, 0),
	};
}

function spawnShark(rng: () => number, max: Vector<2>): Particle {
	const radius = 15 + 15 * rng();
	return {
		id: uuid(rng),
		position: vector<2>(rng() * x(max), rng() * y(max)),

		mass: 1 + radius * 4,

		radius,

		type: ParticleType.Shark,

		velocity: vector<2>(0, 0),
	};
}

const ramp = 'abcdefghijklmnopqrstuvwxyz'.split('');

function spawnRandomBubble(rng: () => number, max: Vector<2>): Particle {
	if (rng() < cyclePos(a()) ** 2 * 0.5) {
		return spawnHeart(rng, max);
	}

	return spawnBubble(rng, max);
}

function spawnRandomParticle(rng: () => number, max: Vector<2>): Particle {
	const rnd = rng();

	if (rnd < 0.1) return spawnShark(rng, max);

	if (rnd < 0.5) return spawnFish(rng, max);

	return spawnRandomBubble(rng, max);
}

const f1 = fields(buoyancy, friction(0.01));

const f2 = fields(f1, friction(0.01));

const f3 = fields(f2, sharkHunger);

const f4 = fields(f3, fishFear);

// im sure i can do better with
// ramda but idk how.
const field = f4;

function sim(dt: number, objects: Set<Particle>): Set<Particle> {
	const step = SimulateField(dt, objects, field);

	return new Set<Particle>(
		[...step].map(v => wrap2(vector<2>(0, 0), vector<2>(1000, 1000))(v))
	);
}

export function FishbowlClient() {
	const size = vector<2>(1000, 1000);
	const [particles, setParticles] = useState<Set<Particle>>(() => {
		const rng = seedrandom('lulu.computer');
		const maxDensity = (x(size) * y(size)) / 1000;
		return new Set<Particle>(
			map(range(0, Math.round(rng() * maxDensity)), () =>
				spawnRandomParticle(rng, size)
			)
		);
	});
	const particlesRef = useRef(particles);
	const lastFrameTime = useRef<number | null>(null);
	const [cameraAngle, setCameraAngle] = useState(0);

	useEffect(() => {
		particlesRef.current = particles;
	}, [particles]);

	useEffect(() => {
		let animationFrame: number | null = null;

		function animate(now: number) {
			const previous = lastFrameTime.current ?? now;
			lastFrameTime.current = now;
			const dt = Math.min((now - previous) / 1000, 0.05);

			if (dt > 0) {
				const nextParticles = sim(dt, particlesRef.current);
				particlesRef.current = nextParticles;
				setParticles(nextParticles);
				setCameraAngle(
					current => current + CAMERA_ORBIT_RADIANS_PER_SECOND * dt
				);
			}

			animationFrame = window.requestAnimationFrame(animate);
		}

		animationFrame = window.requestAnimationFrame(animate);

		return () => {
			if (animationFrame != null) {
				window.cancelAnimationFrame(animationFrame);
			}
		};
	}, []);

	return (
		<Fishbowl cameraAngle={cameraAngle} particles={particles} size={size} />
	);
}
