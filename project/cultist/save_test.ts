import SaveStateExample from 'monorepo/project/cultist/example/savestate.js';
import * as save from 'monorepo/project/cultist/save.js';

test('savestate', () => {
	const test: save.State = SaveStateExample;
	console.log(test);
});
