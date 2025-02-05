"use client";
/**
 * @fileoverview simulation of a bunch of penguins.
 */

import { useEffect, useState } from "react";
import React from 'react';
import random from 'seedrandom';

import { Point, point, x, y, z } from "#root/ts/math/cartesian.js"
import { airFriction, collisionPlaneZ0, earthGravity, fields, kilogram, SimulateField } from "#root/ts/math/sim/sim.js"

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
		velocity: vector<3>(0, 0, 0)
	})

const adeliePenguin =
	(rng: () => number) =>
	(position: Point<3>) => ({
		mass: randomRange(rng)(
			5
		)(7) * kilogram,
		position,
		icon: '🐧',
		velocity: vector<3>(0, 0, 0)
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
					rng() * 5
				)
	 		)));

const field = () => {
	const f1 = fields(
		earthGravity,
		airFriction([[1]])
	);

	return fields(
		f1,
		collisionPlaneZ0,
	)
}

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
					field()
				)
			)
			, tickTimeMilliseconds);


		return () => clearInterval(ticker);
	});

	return <>
		<svg viewBox={[0, 0, 1000, 1000].join(" ")}>
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
		<svg viewBox={[0, 0, 1000, 1000].join(" ")}>
			{
				[...world].map(
					(object, i) => <text
						key={i}
						x={x(object.position)}
					y={1000-z(object.position)}>
						{object.icon}
					</text>
				)
			}
		</svg>


		<table>
			<thead>
				<tr>
					<td>
					icon
					</td>
					<td>
					mass (kg)
					</td>

					<td colSpan={3}>
					position (m)
					</td>

					<td colSpan={3}>
					velocity (m/s)
					</td>

				</tr>
			</thead>
			<tbody>
				{[...world].map(
					(object, i) => <tr key={i}>
						<td>{object.icon}</td>
						<td>{object.mass}</td>
						<td>{x(object.position)}</td>
						<td>{y(object.position)}</td>
						<td>{z(object.position)}</td>

						<td>{x(object.velocity)}</td>
						<td>{y(object.velocity)}</td>
						<td>{z(object.velocity)}</td>
					</tr>
				)}
			</tbody>
		</table>

	</>
}
