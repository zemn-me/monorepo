import main from './lib';
import tmp from 'tmp';
import fs from 'fs/promises';
import { runfiles } from '@bazel/runfiles';
import s from 'child_process';

describe('svgshot', () => {
	it('should render a test URL', async () => {
		const target = await new Promise<string>((ok, err) =>
			tmp.file({ postfix: '.svg' }, (error, path) => {
				if (error) return err(error);
				return ok(path);
			})
		);

        const inkscape = runfiles.resolveWorkspaceRelative(process.env["INKSCAPE_BIN"]!);

        // something weird happens here :(
		await main([
            "fake123",
            "fake1234",
            "--inkscapeBin", inkscape,
            'data:text/plain,Hello, world!', '--out', target
        ]);



		expect(await fs.readFile(target).toString()).toEqual('');
	});
});
