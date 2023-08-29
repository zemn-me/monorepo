import '@pulumi/pulumi';
import 'monorepo/ts/pulumi/setMocks.js';

import * as project from 'monorepo/ts/pulumi/index.js';

describe('pulumi', () => {
	test('smoke', async () => {
		new project.Component('monorepo', { staging: false });
		// eventually I think I need to make
		// the whole setup a custom component to make this
		// actually work.
		await new Promise(ok => setTimeout(ok, 5000));
	});
});
