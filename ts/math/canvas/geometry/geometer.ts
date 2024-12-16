/**
 * @fileoverview utilities for working with geometric diagrams.
 *
 *
 * The purpose of this module is to help to generate annotated
 * geometric diagrams like the below.
 *
 * ┌────────────────────────────────┐
 * │                                │
 * │◄─────────── 20cm ─────────────►│
 */


import * as cartesian from "#root/ts/math/cartesian.js";
import * as matrix from "#root/ts/math/matrix.js";



/**
 * Generates the vertices and edges of a cube for wireframe rendering.
 */
export function cube(
  cx: number,
  cy: number,
  cz: number,
  s: number
): {
  vertices: cartesian.Point3D[];
  edges: [number, number][];
} {
  const half = s / 2;

  // Define the 8 unique corner points of the cube
  const vertices: cartesian.Point3D[] = [
    [[cx - half], [cy - half], [cz - half]], // 0
    [[cx + half], [cy - half], [cz - half]], // 1
    [[cx + half], [cy + half], [cz - half]], // 2
    [[cx - half], [cy + half], [cz - half]], // 3
    [[cx - half], [cy - half], [cz + half]], // 4
    [[cx + half], [cy - half], [cz + half]], // 5
    [[cx + half], [cy + half], [cz + half]], // 6
    [[cx - half], [cy + half], [cz + half]], // 7
  ];

  // Define the 12 edges of the cube
  const edges: [number, number][] = [
    // Bottom face edges
    [0, 1],
[1, 2],
[2, 3],
[3, 0],
    // Top face edges
    [4, 5],
[5, 6],
[6, 7],
[7, 4],
    // Side edges
    [0, 4],
[1, 5],
[2, 6],
[3, 7],
  ];

  return { vertices, edges };
}


/**
 * Generates a polyline for an n-gon.
 */
export function ngon(
  n: number,
  cx: number,
  cy: number,
  r: number
): cartesian.Line2D {
  const points: cartesian.Line2D = [];

  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i) / n;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    const point: cartesian.Point2D = [[x], [y]];
    points.push(point);
  }

  // Optionally close the polygon by adding the first point at the end
  points.push(points[0]!);

  return points;
}


/**
 * Produces a new 2D line that is normal to the given line
 * at point p.
 *
 * ```
 *   ◄───────────l────────────────►
 *  │                              │
 *  │          p ──┐               │
 *  │              ▼               │
 *  ┴──────────────┬───────────────┘
 *                 │
 *                 │length
 *                 │
 *                 ▼
 * ```
 */
export function normal(l: cartesian.Line2D<2>, p: cartesian.Point2D, length: number): cartesian.Line2D<2> {
	const normalLine = cartesian.normal(l);
	const normalVec = matrix.sub<1, 2>(normalLine[0], normalLine[1]);
	const unitNormal = cartesian.unit<2>(normalVec);
	const normalLength = matrix.mul<1, 2, 1, 1>(unitNormal, [[length]]);
	return [
		p,
		matrix.add<1, 2>(p, normalLength)
	]
}

/**
 * A configuration for generating an annotation diagram.
 *
 * A diagram is intended to look something like this:
 * ```
 *  ┬─────────────────────────────────┬
 *  │                                 │
 *  │                                 │
 *  │ ◄────────── text ─────────────► │
 * ```
 *
 * Here is the same diagram, with the parts
 * annotated that this object corresponds to:
 * ```
 * ┬─────────────────────────────────┬──┐
 * │◄────────── columns─────────────►│  │
 * │                                 │  │◄┐
 * │ ◄─────────┬ text ┬────────────► ├──┘ │
 * │ │         │ │  │ │            │ │    │
 * │ │         │ │  │ │            │ │    │
 * │ │         │ │  │ │            │ │    │
 * ┼─┼         │ ┼──┼ │   ┌──────► ┼─┼    │
 * │▲│       ┌►└─┘▲ └─┘◄┐ │        │ │    │
 *  │        │    │     │ │               │
 *  │        │    │     │ │verticalOffset─┘
 *  │        │textwidth │ │
 *  │        │          │ │
 *  │        textpadding┘ │
 *  │                     │
 * arrowGap───────────────┘
 * ```
 */
export interface AnnotateProps {
	textWidth: number,
	textHeight: number
	verticalOffset: number,
	arrowGap: number,
	textPadding: number
}

export interface AnnotateResult {
	columns: [
		leftColumn:
		cartesian.Line2D<2>,
		rightColumn: cartesian.Line2D<2>
	],
	textCentre: cartesian.Point2D,
	arrows: [leftArrow:
		cartesian.Line2D<2>,
		rightArrow: cartesian.Line2D<2>]
}

/**
 * Produces a set of parameters that can be used to annotate the given
 * cartesian line in the below manner:
 * ```
 * ┌────────────────────────────────┐
 * │                                │
 * │◄─────────── 20cm ─────────────►│
 * ```
 *
 * @param props see: {@link AnnotateProps}
 */
export function annotate(l: cartesian.Line2D<2>, props: AnnotateProps): AnnotateResult {
	const [pt1, pt2] = [l[0], l[1]];


	const columnHeight = props.verticalOffset + (props.textHeight / 2);

	const leftCol = normal(
		l, pt1, columnHeight
	);

	const rightCol = normal(
		l, pt2, columnHeight
	)

	const textCentre = normal(
		l, cartesian.centre(l), columnHeight
	)[1];

	const parallelVec =
		matrix.sub<1, 2>(l[1], l[0]);

	const parallelUnit =
		cartesian.unit<2>(parallelVec);

	const len = cartesian.length(l)
	const nonColumnArea = len - (props.arrowGap * 2);
	const arrowArea = nonColumnArea - (props.textPadding * 2)
		- (props.textWidth);

	const arrowLength = arrowArea / 2;

	const leftArrowStartPt: cartesian.Point2D =
		matrix.add<1, 2>(
			leftCol[1],
			matrix.mul<1, 2, 1, 1>(parallelUnit, [[props.arrowGap]])
		);

	const leftArrowEndPt: cartesian.Point2D =
		matrix.add<1, 2>(
			leftArrowStartPt,
			matrix.mul<1, 2, 1, 1>(parallelUnit, [[arrowLength]])
		);

	const leftArrow: cartesian.Line2D<2> = [leftArrowStartPt, leftArrowEndPt];

	const textStartPt: cartesian.Point2D =
		matrix.add<1, 2>(
			leftArrowEndPt,
			matrix.mul<1, 2, 1, 1>(parallelUnit, [[props.textPadding]])
		);

	const textEndPt: cartesian.Point2D =
		matrix.add<1, 2>(
			textStartPt,
			matrix.mul<1, 2, 1, 1>(parallelUnit, [[props.textWidth]])
		);

	const rightArrowStartPt: cartesian.Point2D =
		matrix.add<1, 2>(
			textEndPt,
			matrix.mul<1, 2, 1, 1>(parallelUnit, [[props.textPadding]])
		);

	const rightArrowEndPt: cartesian.Point2D =
		matrix.add<1, 2>(
			rightArrowStartPt,
			matrix.mul<1, 2, 1, 1>(parallelUnit, [[arrowLength]])
		);

	const rightArrow: cartesian.Line2D<2> = [rightArrowStartPt, rightArrowEndPt];







			return {
				columns: [leftCol, rightCol],
				textCentre,
				arrows: [leftArrow, rightArrow]
			}
}

