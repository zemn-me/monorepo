import immutable from 'immutable';
import * as cultist from 'project/cultist';

describe('count', () => {
	test('stacks', () => {
		let stacks: cultist.state.State['elementStacks'] = immutable.Map<
			string,
			cultist.state.ElementInstance
		>();

		stacks = stacks.set('element123', cultist.state.createElement('money'));
		stacks = stacks.set(
			'element1235',
			cultist.state.createElement('money')
		);

		console.log(JSON.stringify(stacks.toJSON()));

		expect(cultist.element.count('money', stacks)).toEqual(2);
	});
});
