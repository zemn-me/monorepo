import { match } from 'ts-pattern';
import { z } from 'zod';

import {
	Inch,
	MilliMeter,
} from '#root/project/zemn.me/app/experiments/framer/model';

const unit = z.enum(['mm', 'in']).describe('unit');

const frameSizesRow = z
	.tuple([
		z.string().describe('name'),
		z.number().describe('width'),
		unit.describe('width unit'),
		z.number().describe('height'),
		unit.describe('height unit'),
	])
	.readonly();

const frameData = [
	['4in x 6in', 4, 'in', 6, 'in'],
	['5in x 7in', 5, 'in', 7, 'in'],
	['8in x 10in', 8, 'in', 10, 'in'],
	['8.5in x 11in', 8.5, 'in', 11, 'in'],
	['11in x 14in', 11, 'in', 14, 'in'],
	['16in x 20in', 16, 'in', 20, 'in'],
	['A0', 841, 'mm', 1189, 'mm'],
	['A1', 594, 'mm', 841, 'mm'],
	['A2', 420, 'mm', 594, 'mm'],
	['A3', 297, 'mm', 420, 'mm'],
	['A4', 210, 'mm', 297, 'mm'],
	['A5', 148, 'mm', 210, 'mm'],
	['A6', 105, 'mm', 148, 'mm'],
	['A7', 74, 'mm', 105, 'mm'],
	['A8', 52, 'mm', 74, 'mm'],
	['A9', 37, 'mm', 52, 'mm'],
	['A10', 27, 'mm', 37, 'mm'],
	['B0', 1000, 'mm', 1414, 'mm'],
	['B1', 707, 'mm', 1000, 'mm'],
	['B2', 500, 'mm', 707, 'mm'],
	['B3', 353, 'mm', 500, 'mm'],
	['B4', 250, 'mm', 353, 'mm'],
	['B5', 176, 'mm', 250, 'mm'],
	['B6', 125, 'mm', 176, 'mm'],
	['B7', 88, 'mm', 125, 'mm'],
	['B8', 62, 'mm', 77, 'mm'],
	['B9', 44, 'mm', 62, 'mm'],
	['B10', 31, 'mm', 44, 'mm'],
	['C0', 917, 'mm', 1297, 'mm'],
	['C1', 648, 'mm', 917, 'mm'],
	['C2', 458, 'mm', 648, 'mm'],
	['C3', 324, 'mm', 458, 'mm'],
	['C4', 229, 'mm', 324, 'mm'],
	['C5', 162, 'mm', 229, 'mm'],
	['C6', 114, 'mm', 162, 'mm'],
	['C5', 71, 'mm', 114, 'mm'],
	['C6', 114, 'mm', 162, 'mm'],
	['C7', 81, 'mm', 114, 'mm'],
	['C8', 57, 'mm', 82, 'mm'],
	['C9', 40, 'mm', 57, 'mm'],
	['C10', 28, 'mm', 40, 'mm'],
] as const;

/**
 * Definitely a way to do this in the type system and I always
 * forget what it's called
 */

declare let __fake: readonly z.TypeOf<typeof frameSizesRow>[];
if (false as true) {
	__fake = frameData;
}

export const frameSizes = frameData.map(
	([name, width, widthUnit, height, heightUnit]) => {
		const [w, h] = (
			[
				[width, widthUnit],
				[height, heightUnit],
			] as const
		).map(([scalar, unit]) =>
			match(unit)
				.with('mm', () => new MilliMeter(scalar))
				.with('in', () => new Inch(scalar))
		);

		return { name, width: w, height: h };
	}
);
