import fs from 'fs/promises';

describe('svgshot', () => {
	it('shoud not have a package.json with a dependency on typescript', async () => {
		const package_json = JSON.parse(
			(await fs.readFile('ts/cmd/svgshot/package.json')).toString()
		);

		expect(package_json.dependencies).not.toContain('typescript');
	});
});
