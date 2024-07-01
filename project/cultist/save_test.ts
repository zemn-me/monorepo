/* eslint-disable no-console */
import SaveStateExample from '#root/project/cultist/example/savestate';
import * as save from '#root/project/cultist/save';

test('savestate', () => {
	const test: save.State = SaveStateExample;
	console.log(test);
});
