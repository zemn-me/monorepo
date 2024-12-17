"use client";
import { extent } from "d3-array";

import { Iterable } from "#root/ts/iter/index.js";
import { Line3D, point, Point3D, x, y } from "#root/ts/math/cartesian.js";
import { Centre, cube, Mesh, mesh2Edges } from "#root/ts/math/mesh/mesh.js";

interface Camera {
	position: Point3D
	lookAt: Point3D
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

export function Map<Object>(p: MapProps<Object>) {
	const cameraViewLine: Line3D<2> = [
		p.scene.camera.position,
		p.scene.camera.lookAt
	];

	const meshesEdges =
		Iterable(
			p.scene.objects)
			.map(p.scene.edges)
			.flatten()

	const lines: Line3D<2>[] = [
		cameraViewLine,
		...meshesEdges.to_array()
	];

	const [xmin, xmax] = extent(
		lines.map(l => [...l].map(pt => x(pt))).flat(2)
	)!

	const [ymin, ymax] = extent(
		lines.map(l => l.map(pt => y(pt))).flat(2)
	)!

	return <svg className={p.className} viewBox={[xmin, ymin, xmax, ymax].join(" ")}>
		<path d={
			lines.map(([start, end]) =>
				`M${[x(start), y(start)]}L${[x(end), y(end)]}`
			).join("")
		}/>
	</svg>
}


export function SceneRenderer<Object>(props: Scene<Object>) {
	return <div style={{
		grid: ""
	}}>
		<Map {...{
			scene: props,
		}}/>
	</div>
}

export function ThreeDClient() {
	const subject =
		cube(
			point<3>(0, 0, 0),
			1
		)
	;

	return <SceneRenderer {...{
		objects: [subject],
		edges: (v: Mesh<8>) => mesh2Edges(v),
		camera: {
			lookAt: subject[Centre],
			position: point<3>(3, 2, 5)
		}
	}}/>
}
