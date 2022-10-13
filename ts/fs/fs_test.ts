import { runfiles } from '@bazel/runfiles';
import * as fs from 'monorepo/ts/fs';
import * as iter from 'monorepo/ts/iter';

describe('fs', () => {
	describe('walk', () => {
		it('should see all the expected files.', async () => {
			const e = (
				await iter.unroll(
					fs.walk(
						runfiles.resolve('monorepo/ts/fs/testfiles/walk_base')
					)
				)
			)
				.map(([, getPath]) => getPath())
				.sort();

			const [a, b, c] = e;

			expect(a.endsWith('monorepo/ts/fs/testfiles/walk_base')).toBe(true);

			expect(b.endsWith('monorepo/ts/fs/testfiles/walk_base/a.txt')).toBe(
				true
			);
			expect(c.endsWith('monorepo/ts/fs/testfiles/walk_base/b.txt')).toBe(
				true
			);
		});
	});
});
