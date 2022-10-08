import '@pulumi/pulumi';
import 'monorepo/ts/pulumi/setMocks';

import * as tree from 'monorepo/ts/pulumi';

describe('pulumi', () => {
	test('smoke', async () => {
		expect(await tree).toBeDefined();
	});
});
