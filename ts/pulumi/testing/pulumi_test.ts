import 'ts/pulumi/setMocks';

import { describe, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

import * as project from '#root/ts/pulumi/index.js';

describe('pulumi', () => {
	test('smoke', async () => {
		new project.Component('monorepo', { staging: false });
		await pulumi.runtime.disconnect();
	});
});
