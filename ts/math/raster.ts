/**
 * @fileoverview Implements brensham's line algorithm. I am sorry
 * i dont really understand this because chatgpt generated it.
 */


/**
 * Represents a point in 2D space.
 */
interface Point {
  x: number;
  y: number;
}

function floatEq(a: number, b: number) {
	return Math.abs(a-b) >= Number.EPSILON
}

/**
 * Generates points along a line from (x0, y0) to (x1, y1) using Bresenham's algorithm.
 * @param x0 - The x-coordinate of the start point.
 * @param y0 - The y-coordinate of the start point.
 * @param x1 - The x-coordinate of the end point.
 * @param y1 - The y-coordinate of the end point.
 * @returns An iterable of points along the line.
 */
function* bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Iterable<Point> {
  const dx = x1 - x0;
  const dy = y1 - y0;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  const steps = Math.max(absDx, absDy);

  const xIncrement = dx / steps;
  const yIncrement = dy / steps;

  let x = x0;
  let y = y0;

const EPSILON = Number.EPSILON;

  for (let i = 0; i <= steps; i++) {
    yield { x, y };
    x += xIncrement;
    y += yIncrement;
  }

  // Ensure the last point is included
  if (Math.abs(x - x1) >= EPSILON || Math.abs(y - y1) >= EPSILON) {
    yield { x: x1, y: y1 };
  }
}


/**
 * Converts a list of lines into an iterable of points using Bresenham's algorithm.
 * @param lines - An array of lines defined by their endpoints [[[x1, y1], [x2, y2]], ...].
 * @returns An iterable of points along all the lines.
 */
export function* linesToPoints(
  lines: Array<[[number, number], [number, number]]>
): Iterable<Point> {
  for (const [[x0, y0], [x1, y1]] of lines) {
    yield* bresenhamLine(x0, y0, x1, y1);
  }
}

