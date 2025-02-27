import { describe, expect, test } from '@jest/globals';
import sharpT from 'sharp';

import { doSync, JSONObject } from '#root/ts/do-sync/index.js';

const pixel =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const resized =
	'/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCDgB1If//Z';

const fn = async (a: string, b: number, c: string) => `${a}${b}${c}`;

interface resizeOpts extends sharpT.JpegOptions, JSONObject {
	width: number;
	height: number;
}

interface resizeRet extends JSONObject {
	width: number;
	height: number;
	blob: string;
}

const resizeAsync = doSync(
	async (
		target: string,
		{ width, height, ...jpegOpions }: resizeOpts
	): Promise<resizeRet> => {
		// this is needed because the function is removed from its context.
		// in the future, I might change the API to work based on whole files instead,
		// which would avoid this issue.
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const sharp = require('sharp') as typeof sharpT;
		const blob = (
			await sharp(Buffer.from(target, 'base64'))
				.resize(width, height)
				.jpeg(jpegOpions)
				.toBuffer()
		).toString('base64');
		return { blob, width, height };
	}
);

describe('AsyncFn', () => {
	test('resizeAsync', () => {
		expect(
			resizeAsync(pixel, {
				width: 2,
				height: 2,
			})
		).toEqual({
			blob: resized,
			width: 2,
			height: 2,
		});
	});
});

describe('doSync', () => {
	test('basic', () => {
		expect(doSync(fn)('ok', 1, 'ok'));
	});

	test('error handling', () => {
		expect(() =>
			doSync(() => {
				throw 'whoopsie';
			})()
		).toThrow();
		expect(() =>
			doSync(() => {
				throw 'whoopsie';
			})()
		).toThrow('whoopsie');
	});
});
