import * as Camera from '#monorepo/ts/math/camera.js';

describe('Camera', () => {
	describe('.matrix', () => {
		it('should produce the f=1 camera matrix', () => {
			expect(Camera.matrix(1)).toEqual([
				[1, 0, 0, 0],
				[0, 1, 0, 0],
				[0, 0, 1, 0],
			]);
		});
	});
});
