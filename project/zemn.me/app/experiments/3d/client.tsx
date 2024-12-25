"use client";
import { extent } from "d3-array";
import React, { Fragment, useId, useState } from "react";

import { Iterable } from "#root/ts/iter/index.js";
import { camera } from "#root/ts/math/camera.js";
import { clamp3DTo2D, Line2D, Line3D, point, Point3D, x, y } from "#root/ts/math/cartesian.js";
import { Centre, cube, Mesh, mesh2Edges } from "#root/ts/math/mesh/mesh.js";

interface Camera {
	position: Point3D
	lookAt: Point3D
}

interface EdgesRendererProps {
	readonly edges: Line2D<2>[]
}

function EdgesRenderer(props: EdgesRendererProps) {
	const { edges } = props;

	// Compute the viewBox from the extents of the edges
	const [xmin, xmax] = extent(edges.map(l => l.map(pt => x(pt))).flat(2))!;
	const [ymin, ymax] = extent(edges.map(l => l.map(pt => y(pt))).flat(2))!;

	return (
		<>
			{Object.entries({ xmin, xmax, ymin, ymax }).map(([k, v]) => <>
				{k}: {v}{" "}</>)}
			<svg height={200} viewBox={[xmin, ymin, xmax, ymax].join(" ")} width={200}>
				{edges.map((edge, i) => {
					const [start, end] = edge;
					return (
						<line
							key={i}
							stroke="black" strokeWidth={(xmax! - xmin!) / 100}
							x1={x(start)} x2={x(end)}
							y1={y(start)}
							y2={y(end)}
						/>
					);
				})}
			</svg>
		</>
	);
}

interface Scene<Object> {
	readonly objects: Object[]
	readonly edges: (v: Object) => globalThis.Iterable<Line3D<2>>
	readonly camera: Camera
}

interface MapProps<Object> {
	className?: string
	scene: Scene<Object>
}

function Map<Object>(p: MapProps<Object>) {
	const cameraViewLine: Line3D<2> = [
		p.scene.camera.position,
		p.scene.camera.lookAt
	];

	const meshesEdges =
		Iterable(p.scene.objects)
			.map(p.scene.edges)
			.flatten();

	const lines: Line3D<2>[] = [
		cameraViewLine,
		...meshesEdges.to_array()
	];

	// Convert 3D lines to 2D
	const edges2D: EdgesRendererProps["edges"] = lines.map(([s, e]) => [
		clamp3DTo2D(s), clamp3DTo2D(e)
	]) as Line2D<2>[];

	return <EdgesRenderer edges={edges2D} />;
}

function Projection<Object>(p: MapProps<Object>) {
	return <EdgesRenderer edges={
		Iterable(p.scene.objects)
			.map(p.scene.edges)
			.flatten()
			.map(([start, end]): Line2D<2> =>
				[
					camera(
						p.scene.camera.position,
						p.scene.camera.lookAt,
						start,
						4,
					),
					camera(
						p.scene.camera.position,
						p.scene.camera.lookAt,
						end,
						4,
					),
				]).to_array()
	} />

}


export function SceneRenderer<Object>(props: Scene<Object>) {
	return <div style={{ grid: "" }}>
		{/* top down map */}
		<Map scene={props} />
		{/* projection */}
		<Projection scene={props} />
	</div>
}

export function ThreeDClient() {
	const subject = cube(point<3>(0, 0, 0), 1);
	const xyz = [1, 5, 2].map(v => useState<number>(v));

	return <>
		{xyz.map(([g, s], i) => <Fragment key={`axis${i}`}>

			<input
			id={useId()} key={`axis${i}`}
			max="50" min="-50" onChange={t => s(+t.target.value)}
				type="range" value={g} />

			{g}

		</Fragment>)}
		<SceneRenderer
			camera={{
				lookAt: subject[Centre],
				position: point<3>(
					...xyz.map(([g]) => g) as [number, number, number]
				)
			}}
			edges={(v: Mesh<8>) => mesh2Edges(v)}
			objects={[subject]}
		/></>;
}
