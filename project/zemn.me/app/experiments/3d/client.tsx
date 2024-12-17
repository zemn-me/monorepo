import { Point3D } from "#root/ts/math/cartesian.js";

export const Objects = Symbol();
export const Edges = Symbol();
export const Camera = Symbol();

interface SceneProps<Object> {
	readonly [Objects]: Object[]
	readonly [Edges]: (v: Object) => Point3D[]
	readonly [Camera]: Point3D
}

export function Scene<Object>(props: SceneProps<Object>) {
	return <div style={{
		grid: ""
	}}>
		<svg style={{
			gridArea: "render"
		}}>
			{ }

		</svg>
		<svg style={{
			gridArea: "map"
		}}>

			{ }
		</svg>
	</div>
}

export function ThreeDClient() {

}
