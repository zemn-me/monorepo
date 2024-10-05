import { describe, expect, it } from '@jest/globals';

import { plot2D } from '#root/ts/math/canvas/braille/braille.js';
import { cube } from '#root/ts/math/canvas/geometry/geometer.js';
import { denormaliseLine2D, Line2D, Line3D, toLineSegments } from '#root/ts/math/cartesian.js';
import * as Homogenous from '#root/ts/math/homog.js'
import { linesToPoints } from '#root/ts/math/raster.js';
import { project } from '#root/ts/math/space/render/project.js';

describe('3d', () => {

	it('should draw a cube', () => {
		const c = cube(0, 0, 0, 3);

		const edges: Line3D<2>[] = c.edges.map(([start, end]) => [
			c.vertices[start]!, c.vertices[end]!
		]);

		const pts2d: Line2D<2>[] = edges.map<Homogenous.Line2D<2>>(pts =>
			pts.map<Homogenous.Point2D>(([[x], [y], [z]]) => project(10, [[x], [y], [z], [1]]))
		).map(pts => pts.map(([[x], [y], [a]]) => [[x * a], [y * a]]));


		// project the cube from 3d space to 2d space.

		expect(plot2D(
			linesToPoints(
				toLineSegments(pts2d).map(v => denormaliseLine2D(v))
			),
			pt => pt.x,
			pt => pt.y,
			100
		)).toEqual(`egg`)


	})
})


