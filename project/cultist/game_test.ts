import { beforeAll, describe, expect, test } from '@jest/globals';

import { loadCoreContent } from '#root/project/cultist/content_node.js';
import {
	availableRecipesForVerb,
	count,
	GameData,
	indexCore,
	newGame,
	playRecipeToCompletion,
	recipeStatuses,
} from '#root/project/cultist/game.js';

let data: GameData;

beforeAll(async () => {
	data = indexCore(await loadCoreContent());
});

describe('cultist browser game model', () => {
	test('loads official core elements, recipes, verbs, decks, and legacies', () => {
		expect(data.core.elements.length).toBeGreaterThan(1000);
		expect(data.core.recipes.length).toBeGreaterThan(1000);
		expect(data.core.decks.length).toBeGreaterThan(20);
		expect(data.core.verbs.map(verb => verb.id)).toContain('work');
		expect(data.core.legacies.map(legacy => legacy.id)).toContain('aspirant');
		expect(data.elements.get('locksmithsdream1')?.label).toEqual(
			"The Locksmith's Dream: a Light through the Keyhole"
		);
	});

	test('the Aspirant starts with the official opening work recipe', () => {
		const state = newGame(data);

		expect(count(state, 'introjob')).toEqual(1);
		expect(availableRecipesForVerb(data, state, 'work').map(s => s.recipe.id)).toContain(
			'workintrojob'
		);
		expect(
			recipeStatuses(data, state).some(
				status => status.recipe.label === 'Read The Locksmith Dreamed'
			)
		).toEqual(false);
	});

	test('the official intro chain unlocks the bequest and studies it', () => {
		let state = newGame(data);

		state = playRecipeToCompletion(data, state, 'workintrojob');

		expect(count(state, 'introjob')).toEqual(0);
		expect(count(state, 'health')).toEqual(1);
		expect(count(state, 'passion')).toEqual(1);
		expect(count(state, 'reason')).toEqual(1);
		expect(count(state, 'bequestintro')).toEqual(1);
		expect(
			state.log.find(entry => entry.title === 'A Change in the Air')?.source
		).toEqual({
			kind: 'alt',
			recipeId: 'introdream',
			title: 'Recall my Dreams',
		});
		expect(
			state.log.find(entry => entry.title === 'A Bequest Arrives')?.source
		).toEqual({
			kind: 'linked',
			recipeId: 'bequestcountdown',
			title: 'A Change in the Air',
		});

		state = playRecipeToCompletion(data, state, 'studybequestreason');

		expect(count(state, 'bequestintro')).toEqual(0);
		expect(count(state, 'ascensionenlightenmenta')).toEqual(1);
		expect(count(state, 'fragmentlantern')).toEqual(1);
		expect(count(state, 'mapbookdealer')).toEqual(1);
		expect(state.log.at(-1)?.outputs).toContainEqual({
			card: 'fragmentlantern',
			count: 1,
		});
	});
});
