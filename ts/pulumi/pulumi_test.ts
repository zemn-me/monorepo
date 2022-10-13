import '@pulumi/pulumi';
import 'monorepo/ts/pulumi/setMocks';

import * as tree from 'monorepo/ts/pulumi';

describe('pulumi', () => {
	test('smoke', async () => {
		expect(await tree).toBeDefined();

		// this should probably go somewhere else some day

		// at least one of these needs to be an index.html

		expect(tree.dog.pleaseintroducemetoyour.Public.files).not.toBeFalsy();

		expect(
			(
				await Promise.all(
					(
						await Promise.all(
							await (
								await tree
							).dog.pleaseintroducemetoyour.Public.files
						)
					).map(v => v.path)
				)
			).join('\n')
		).toContain('index.html');
	});
});
