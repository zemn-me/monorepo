import '@pulumi/pulumi';
import 'ts/pulumi/setMocks';

import * as tree from 'ts/pulumi';

describe('pulumi', () => {
	test('smoke', async () => {
		expect(await tree).toBeDefined();
	});
});
