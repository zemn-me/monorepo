import SaveStateExample from 'monorepo/project/cultist/example/savestate';
import * as save from 'monorepo/project/cultist/save';

test('savestate', () => {
	const test: save.State = SaveStateExample;
	console.log(test);
});
