/* biome-ignore-all lint/suspicious/noConsole: this file intentionally writes to the console */
import { test } from '@jest/globals';

import SaveStateExample from '#root/project/cultist/example/savestate.js';
import * as save from '#root/project/cultist/save.js';

test('savestate', () => {
	const test: save.State = SaveStateExample;
	console.log(test);
});
