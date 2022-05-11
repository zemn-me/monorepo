import main from './lib';
import tmp from 'tmp';
import fs from 'fs/promises';

describe('svgshot', () => {
	it('should render a test URL', async () => {
		const target = await new Promise<string>((ok, err) =>
			tmp.file({ postfix: '.svg' }, (error, path) => {
				if (error) return err(error);
				return ok(path);
			})
		);

		await main([
            "--inkscapeBin", process.env["INKSCAPE_BIN"]!,
            'data:text/plain,Hello, world!', '--out', target
        ]);

		expect(fs.readFile(target).toString()).toEqual('');
	});
});
