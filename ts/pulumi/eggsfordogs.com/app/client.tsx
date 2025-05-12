
"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import React from 'react';
import seedrandom from 'seedrandom';

import { filter, fold, map, range, to_array } from '#root/ts/iter/iterable_functional.js';
import { add, mul, Point, point, sub, x, y } from '#root/ts/math/cartesian.js';
import { fields, SimulateField, wrap2 } from '#root/ts/math/sim/sim.js';
import { and_then, None, Option, Some, unwrap_or } from '#root/ts/option/types.js';

type Vector<N extends number = number> = Point<N>;
const vector = point;
const sum = add;
const scalar = (n: number) => vector<1>(n);

enum ParticleType {
	Egg,
	Dog,
}

type Particle = {
	id: string;
	position: Vector<2>;
	velocity: Vector<2>;
	mass: number;
	radius: number;
	type: ParticleType;
};

interface YardProps {
	readonly particles: Set<Particle>;
	readonly size: Vector<2>;
}

function icon(p: Particle): string {
	switch (p.type) {
		case ParticleType.Egg:
			return "🥚";
		case ParticleType.Dog:
			return "🐕";
	}
}

const sumAll = (pts: Vector<2>[]) =>
	fold((p: Vector<2>, c: Vector<2>) => sum<1, 2>(p, c))(vector<2>(0, 0))(pts);

const avg = (pts: Vector<2>[]): Vector<2> =>
	mul<1, 2, 1, 1>(sumAll(pts), scalar(1 / pts.length));

const centre = avg;


function eggRoll(_: number, self: Particle, __: Set<Particle>): Vector<2> {
	if (self.type !== ParticleType.Egg) return vector<2>(0, 0);
	// Gentle random motion to simulate rolling
	return vector<2>((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
}

function dogHerd(_: number, self: Particle, all: Set<Particle>): Vector<2> {
	if (self.type !== ParticleType.Dog) return vector<2>(0, 0);

	const maybeEggs = map(all, v => v.type === ParticleType.Egg ? Some(v) : None);

	const eggs = new Set(filter(maybeEggs));

	if (eggs.size === 0) return vector<2>(0, 0);

	const eggCentre = centre([...map(eggs, v => v.position)]);

	// vector pointing at centre of the eggs
	const toCentre = sub<1, 2>(eggCentre, self.position);

	const mag = Math.hypot(x(toCentre), y(toCentre));
	if (mag === 0) return vector<2>(0, 0);

	return mul<1, 2, 1, 1>(toCentre, scalar(20 / mag));
}

const friction = (c: number) => (_: number, self: Particle): Vector =>
	vector(-x(self.velocity) * c * self.radius, -y(self.velocity) * c * self.radius);

function Yard(props: YardProps) {
	return <svg style={{ width: "100vw", height: "100vh" }}>
		<rect fill="#e6f2ff" height="100%" width="100%" />
		{to_array(map(props.particles, p => <text key={p.id} style={{ textAnchor: "middle", fontSize: `${p.radius}` }} x={x(p.position)} y={y(props.size) - y(p.position)}>{icon(p)}</text>))}
	</svg>;
}

function uuid(rng: () => number) {
	const ramp = "abcdefghijklmnopqrstuvwxyz".split("");
	return to_array(map(range(0, 10), () => ramp[Math.floor(rng() * ramp.length)])).join("");
}

function spawnEgg(rng: () => number, max: Vector<2>): Particle {
	const radius = 10 + 10 * rng();
	return {
		id: uuid(rng),
		position: vector<2>(rng() * x(max), rng() * y(max)),
		radius,
		mass: 1,
		type: ParticleType.Egg,
		velocity: vector<2>(0, 0),
	};
}

function spawnDog(rng: () => number, max: Vector<2>): Particle {
	const radius = 20;
	return {
		id: uuid(rng),
		position: vector<2>(rng() * x(max), rng() * y(max)),
		radius,
		mass: 3,
		type: ParticleType.Dog,
		velocity: vector<2>(0, 0),
	};
}

function spawnRandomParticle(rng: () => number, max: Vector<2>): Particle {
	return rng() < 0.1 ? spawnDog(rng, max) : spawnEgg(rng, max);
}

const fieldA = fields(
	friction(0.05),
	eggRoll,
);

const field = fields(
	fieldA,
	dogHerd
)

function sim(dt: number, objects: Set<Particle>): Set<Particle> {
	return new Set([...SimulateField(dt, objects, field)].map(
		v => wrap2(vector<2>(0, 0), vector<2>(1000, 1000))(v)
	));
}

export function EggDogYardClient() {
	const rng = seedrandom('eggdog');
	const size = vector<2>(1000, 1000);
	const maxDensity = (x(size) * y(size)) / 10000;
	const [particles, setParticles] = useState(new Set(map(range(0, Math.round(rng() * maxDensity)), () => spawnRandomParticle(rng, size))));
	const lastFrameTime = useRef<Option<number>>(None);

	const onTick = useCallback<FrameRequestCallback>(() => {
		const now = performance.now();
		const dt = unwrap_or(and_then(lastFrameTime.current, last => now - last), 0);
		lastFrameTime.current = Some(now);
		setParticles(sim(dt / 1000, particles));
	}, [particles]);

	useEffect(() => {
		const hnd = setInterval(onTick, 15);
		return () => clearInterval(hnd);
	}, [onTick]);

	return <Yard particles={particles} size={size} />;
}
