/**
 * @fileoverview simulation of a bunch of penguins.
 */

import { point, Point } from "#root/ts/math/cartesian.js"
import { kilogram, SimulateField } from "#root/ts/math/sim/sim.js"
import { useEffect, useState } from "react";
import random from 'seedrandom';

const vector = point



const penguin =
	(rng: () => number) =>
	(position: Point<3>) => ({
		mass: 23 * kilogram,
		position,
		icon: '🐧',
		velocity: vector<3>(0,0,0)
	})

const objects = (rng: () => number) =>
	(nPenguins: number) =>
		new Set([...Array(nPenguins)].map(() =>
			penguin(
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

	useEffect(() => {
		const ticker = setInterval(
			() => setWorld(

			)
		)
	})


}
