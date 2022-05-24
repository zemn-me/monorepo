import main from './lib';
import tmp from 'tmp';
import fs from 'fs/promises';
import { runfiles } from '@bazel/runfiles';

describe('svgshot', () => {
	it('should render a test URL', async () => {
		const target = await new Promise<string>((ok, err) =>
			tmp.file(
				{
					// https://docs.bazel.build/versions/main/test-encyclopedia.html#test-interaction-with-the-filesystem
					tmpdir: process.env['TEST_TMPDIR'] || undefined,
					postfix: '.svg',
				},
				(error, path) => {
					if (error) return err(error);
					return ok(path);
				}
			)
		);

		const inkscape =
			runfiles.resolveWorkspaceRelative('cc/inkscape/run.sh');

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

		expect(result).not.toEqual('');
		expect(result).not.toBeUndefined();
		expect(result).not.toBeNull();

		expect(result).toEqual(
			`<svg xml:space="preserve" width="1000" height="1000" xmlns="http://www.w3.org/2000/svg"><defs><clipPath clipPathUnits="userSpaceOnUse" id="a"><path d="M0 0h3125v3125H0Z" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#a)" transform="scale(.32)"><path d="M0 0h1000v1000H0Z" style="fill:#fff;fill-opacity:1;fill-rule:nonzero;stroke:none" transform="scale(3.125)"/><text transform="translate(25 75) scale(3.125)" style="font-variant:normal;font-weight:400;font-size:13px;font-family:'Liberation Mono';-inkscape-font-specification:LiberationMono;writing-mode:lr-tb;fill:#000;fill-opacity:1;fill-rule:nonzero;stroke:none"><tspan x="0 7.8012695 15.602539 23.403809 31.205078 39.006348 46.807617 54.608887 62.410156 70.211426 78.012695 85.813965 93.615234" y="0">Hello, world!</tspan></text></g></svg>`
		);
	});
});
