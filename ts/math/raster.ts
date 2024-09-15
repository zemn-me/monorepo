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
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;

	for (; ;) {
    yield { x, y };
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
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

