import { describe, expect, test } from '@jest/globals';

import {
	advanceTime,
	advanceToNextCompletion,
	availableRecipesForVerb,
	count,
	GameState,
	newGame,
	playRecipeToCompletion,
	startRecipe,
} from '#root/project/cultist/game.js';

function play(state: GameState, ...recipeIds: readonly string[]): GameState {
	return recipeIds.reduce(
		(next, recipeId) => playRecipeToCompletion(next, recipeId),
		state
	);
}

describe('cultist browser game model', () => {
	test('a full Enlightenment playthrough can be completed', () => {
		let state = newGame();

		state = play(
			state,
			'work_menial',
			'work_menial',
			'work_menial',
			'work_menial',
			'study_bequest',
			'study_book_lantern',
			'dream_temptation',
			'explore_moonlit_streets',
			'study_reason',
			'study_lantern_4',
			'talk_found_cult',
			'dream_dedication',
			'study_reason',
			'study_lantern_6',
			'talk_recruit_student',
			'explore_hidden_room',
			'dream_white_door',
			'study_passion',
			'dream_bright_influence',
			'study_passion',
			'dream_bright_influence',
			'study_reason',
			'study_lantern_8',
			'dream_opened_eye',
			'study_reason',
			'study_lantern_10',
			'dream_last_brightness',
			'work_enlightenment_victory'
		);

		expect(state.ending).toEqual('enlightenment');
		expect(count(state, 'lantern_lore_10')).toEqual(1);
		expect(count(state, 'student_lantern')).toBeGreaterThanOrEqual(1);
		expect(state.log.at(-1)?.title).toEqual('Invoke the Watchman');
	});

	test('recipes are blocked until their requirements exist', () => {
		const state = newGame();

		expect(() => startRecipe(state, 'work_enlightenment_victory')).toThrow(
			/Ascension: The Last Brightness 0\/1/
		);
		expect(availableRecipesForVerb(state, 'work').map(s => s.recipe.id)).toEqual([
			'work_menial',
		]);
	});

	test('verbs can only hold one operation at a time', () => {
		const state = startRecipe(newGame(), 'work_menial');

		expect(() => startRecipe(state, 'work_menial')).toThrow(
			/Work is already occupied/
		);
		expect(advanceTime(state, 45).operations.work).toEqual(undefined);
	});

	test('recipe logs record the cards that went in and came out', () => {
		const started = startRecipe(newGame(), 'study_bequest');

		expect(started.log.at(-1)?.inputs).toEqual([
			{ card: 'bequest', count: 1 },
		]);
		expect(started.log.at(-1)?.outputs).toEqual(undefined);

		const completed = advanceToNextCompletion(started);

		expect(completed.log.at(-1)?.inputs).toEqual(undefined);
		expect(completed.log.at(-1)?.outputs).toEqual([
			{ card: 'book_lantern', count: 1 },
			{ card: 'lantern_lore_2', count: 1 },
		]);
	});

	test('ordinary seasons make neglect dangerous', () => {
		const state = advanceTime(
			{
				...newGame(),
				inventory: {
					...newGame().inventory,
					funds: 0,
				},
			},
			180
		);

		expect(state.ending).toEqual('death');
		expect(state.log.at(-1)?.title).toEqual('A bodily ending');
	});
});
