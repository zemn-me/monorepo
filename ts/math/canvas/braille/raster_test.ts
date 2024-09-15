
import { describe, expect, it } from '@jest/globals';

import {
	plot2D,
} from '#root/ts/math/canvas/braille/braille.js';
import { linesToPoints } from '#root/ts/math/raster.js';

describe('raster', () => {
		it('should make a straight line', () => {
			expect(
				plot2D(
					linesToPoints( [ [ [0, 0], [10, 10], ] ]),
					pt => pt.x,
					pt => pt.y,
					6
				)
			).toEqual(`\
⠑⢄⠀
⠀⠀⠑\
`)
		});

		it('should make a straight line (-ve)', () => {
			expect(
				plot2D(
					linesToPoints( [ [ [-10, -10], [10, 10], ] ]),
					pt => pt.x,
					pt => pt.y,
					6
				)
			).toEqual(`\
⠑⢄⠀
⠀⠀⠑\
`)
		});

		it('should not crash', () => {
			expect(
				plot2D(
					linesToPoints( [ [ [0, 0], [-1.5, 0], ] ]),
					pt => pt.x,
					pt => pt.y,
					6
				)
			).toEqual(`\
⠀⠀⠀
⠂⠂⠐\
`)
		});


});
