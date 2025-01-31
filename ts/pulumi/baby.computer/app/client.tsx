/**
 * @fileoverview simulation of a bunch of penguins.
 */

import { Iterable } from "#root/ts/iter/index.js";
import { point, Point, x, y } from "#root/ts/math/cartesian.js"
import { earthGravity, kilogram, SimulateField } from "#root/ts/math/sim/sim.js"
import { useEffect, useState } from "react";
import random from 'seedrandom';

const vector = point

const randomRange =
	(rng: () => number) =>
	(max: number) =>
	(min: number) => {
		const range = max - min;
		const variance = rng() * range;

		return min + variance;
	}



const kingPenguin =
	(rng: () => number) =>
	(position: Point<3>) => ({
		mass: randomRange(rng)(
			9
		)(15) * kilogram,
		position,
		icon: '🐧',
		velocity: vector<3>(0,0,0)
	})

const adeliePenguin =
	(rng: () => number) =>
	(position: Point<3>) => ({
		mass: randomRange(rng)(
			5
		)(7) * kilogram,
		position,
		icon: '🐧',
		velocity: vector<3>(0,0,0)
	})


const newPenguin =
	(rng: () => number) =>
		(
			rng() > 0.5 ?
				adeliePenguin: kingPenguin
		)(rng)

const objects = (rng: () => number) =>
	(nPenguins: number) =>
		new Set([...Array(nPenguins)].map(() =>
			newPenguin(
				rng
			)(
				point<3>(
					rng() * 1000,
					rng() * 1000,
					0
				)
	 		)));

export function PenguinSim() {
	const [world, setWorld] =
		useState(objects(random('baby.computer'))(100));

	const tickTimeSeconds = 1 / 1000;
	const tickTimeMilliseconds =
		tickTimeSeconds * 1000;

	useEffect(() => {
		const ticker = setInterval(
			() => setWorld(
				SimulateField(
					tickTimeSeconds,
					world,
					earthGravity
				)
			)
			, tickTimeMilliseconds);


		return () => clearInterval(ticker);
	});

	return <>
		<svg viewBox={[0,0,1000,1000].join(" ")}>
			{
				[...world].map(
					object => <text
						x={x(object.position)}
					y={y(object.position)}>
						{object.icon}
					</text>
				)
			}
		</svg>

	</>
}
