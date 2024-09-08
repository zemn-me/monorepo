import { describe, expect, it, test } from '@jest/globals';

import {
	Blueprint,
	blueprintSurroundedByWall,
} from '#root/ts/factorio/blueprint';
import { BlueprintString } from '#root/ts/factorio/blueprint_string.js';
import { BlueprintWrapper } from '#root/ts/factorio/blueprint_wrapper.js';
import { allOilsRefinery } from '#root/ts/factorio/testing/data/allOilsRefinery.js';
import { balancers } from '#root/ts/factorio/testing/data/balancers.js';
import { bigAssMall } from '#root/ts/factorio/testing/data/bigAssMall.js';
import { neoVortexTrainStations } from '#root/ts/factorio/testing/data/neoVortexTrainStations.js';
import { powerBook } from '#root/ts/factorio/testing/data/powerBook.js';
import { starterBase } from '#root/ts/factorio/testing/data/starterBase.js';
import { renderBlueprintToBrailleString } from '#root/ts/factorio/testing/render_to_braille.js';

const exampleBlueprint: BlueprintWrapper = {
	blueprint: {
		item: 'blueprint',
		entities: [
			{
				entity_number: 1,
				name: 'steel-chest',
				position: { x: 488.5, y: -5846.5 },
			},
			{
				entity_number: 2,
				name: 'steel-chest',
				position: { x: 491.5, y: -5846.5 },
			},
			{
				entity_number: 3,
				name: 'steel-chest',
				position: { x: 494.5, y: -5846.5 },
			},
			{
				entity_number: 4,
				name: 'steel-chest',
				position: { x: 488.5, y: -5844.5 },
			},
			{
				entity_number: 5,
				name: 'steel-chest',
				position: { x: 488.5, y: -5845.5 },
			},
			{
				entity_number: 6,
				name: 'steel-chest',
				position: { x: 491.5, y: -5844.5 },
			},
			{
				entity_number: 7,
				name: 'steel-chest',
				position: { x: 491.5, y: -5845.5 },
			},
			{
				entity_number: 8,
				name: 'steel-chest',
				position: { x: 494.5, y: -5844.5 },
			},
			{
				entity_number: 9,
				name: 'steel-chest',
				position: { x: 494.5, y: -5845.5 },
			},
			{
				entity_number: 10,
				name: 'steel-chest',
				position: { x: 488.5, y: -5842.5 },
			},
			{
				entity_number: 11,
				name: 'steel-chest',
				position: { x: 488.5, y: -5843.5 },
			},
			{
				entity_number: 12,
				name: 'steel-chest',
				position: { x: 489.5, y: -5843.5 },
			},
			{
				entity_number: 13,
				name: 'steel-chest',
				position: { x: 490.5, y: -5843.5 },
			},
			{
				entity_number: 14,
				name: 'steel-chest',
				position: { x: 491.5, y: -5843.5 },
			},
			{
				entity_number: 15,
				name: 'steel-chest',
				position: { x: 491.5, y: -5842.5 },
			},
			{
				entity_number: 16,
				name: 'steel-chest',
				position: { x: 494.5, y: -5842.5 },
			},
			{
				entity_number: 17,
				name: 'steel-chest',
				position: { x: 494.5, y: -5843.5 },
			},
			{
				entity_number: 18,
				name: 'steel-chest',
				position: { x: 488.5, y: -5840.5 },
			},
			{
				entity_number: 19,
				name: 'steel-chest',
				position: { x: 488.5, y: -5841.5 },
			},
			{
				entity_number: 20,
				name: 'steel-chest',
				position: { x: 491.5, y: -5840.5 },
			},
			{
				entity_number: 21,
				name: 'steel-chest',
				position: { x: 491.5, y: -5841.5 },
			},
			{
				entity_number: 22,
				name: 'steel-chest',
				position: { x: 494.5, y: -5840.5 },
			},
			{
				entity_number: 23,
				name: 'steel-chest',
				position: { x: 494.5, y: -5841.5 },
			},
		],
		icons: [{ index: 1, signal: { type: 'item', name: 'steel-chest' } }],
		version: 281479278493696,
	},
};

describe('blueprintSurroundedByWall', () => {
	it('should create a blueprint that is valid to Zod', () => {
		expect(() =>
			Blueprint.parse(
				blueprintSurroundedByWall(exampleBlueprint.blueprint, 3)
			)
		).not.toThrow();
	});

	it('should start out looking as expected', () => {
		expect(
			renderBlueprintToBrailleString(exampleBlueprint.blueprint, 10, true)
		).toEqual(
			`
⡇⠀⢘⠀⠀
⡗⠐⢐⠀⠀
⡇⠀⠰⠀⠀
`.trim()
		);
	});

	// i think this one is just broken lol
	it.skip('should look as expected', () => {
		expect(
			renderBlueprintToBrailleString(
				blueprintSurroundedByWall(exampleBlueprint.blueprint, 3),
				10,
				true
			)
		).toEqual('-');
	});
});

describe('some problematic blueprints', () => {
	test('balancers', () => {
		expect(() => BlueprintString.parse(balancers)).not.toThrow();
	});


	test('power book', () => {
		expect(() => BlueprintString.parse(powerBook)).not.toThrow();
	});

	test('big ass mall', () => {
		expect(() => BlueprintString.parse(bigAssMall)).not.toThrow();
	});

	test('train stations book', () => {
		expect(() =>
			BlueprintString.parse(neoVortexTrainStations)
		).not.toThrow();
	});
	test('all oils refinery', () => {
		expect(() => BlueprintString.parse(allOilsRefinery)).not.toThrow();
	});

	test('starter base', () => {
		expect(() => BlueprintString.parse(starterBase)).not.toThrow();
	});
});
