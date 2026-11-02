import * as aspects from '#root/project/cultist/aspects.js';
import * as cultist from '#root/project/cultist/types.js';
import * as Verb from '#root/project/cultist/verb.js';

/**
 * Given a set of verbs, recipes and elements, return an iterable subset
 * of recipes that can be applied
 */
function* availableRecipes(
	verbs: Iterable<cultist.Verb>,
	recipes: Iterable<cultist.Recipe>,
	elems: Iterable<cultist.Element>
) {
	for (const [verb, elements] of Verb.combos(verbs, elems)) {
		const sum = aspects.sum(elements);
		RECIPE: for (const recipe of recipes) {
			if (!recipe.craftable) continue RECIPE;
			if (recipe.actionid !== undefined && verb.id !== recipe.actionid)
				continue;

			for (const [aspect, intensity] of Object.entries(
				recipe.requirements ?? {}
			)) {
				if ((sum.get(aspect) ?? 0) < intensity) continue RECIPE;
			}

			yield [recipe, elements] as [cultist.Recipe, cultist.Element[]];
		}
	}
}

export { availableRecipes as available };
