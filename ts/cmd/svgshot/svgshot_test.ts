import fs from 'fs/promises';
import tmp from 'tmp';
import main from 'ts/cmd/svgshot/lib';

jest.setTimeout(30000);

describe('svgshot', () => {
	// todo: one day I would like this test to work consistently
	it.skip('should render a test URL', async () => {
		const [target, cleanup] = await new Promise<[string, () => void]>(
			(ok, err) =>
				tmp.file(
					{
						// https://docs.bazel.build/versions/main/test-encyclopedia.html#test-interaction-with-the-filesystem
						tmpdir: process.env['TEST_TMPDIR'] || undefined,
						postfix: '.svg',
					},
					(error, path, _, cleanup) => {
						if (error) return err(error);
						return ok([path, cleanup]);
					}
				)
		);

		const inkscape = 'cc/inkscape/inkscape.sh';

		await expect(
			main([
				'fake123',
				'fake1234',
				'--inkscapeBin',
				inkscape,
				'data:text/plain,Hello, world!',
				'--out',
				target,
			])
		).resolves.toBeUndefined();

		const result = (await fs.readFile(target)).toString();

		cleanup();

		expect(result).not.toEqual('');
		expect(result).not.toBeUndefined();
		expect(result).not.toBeNull();

		// would be better in future to parse the svg and calculate its
		// textContent
		expect(result).toContain('Hello, world!');
	});
});
