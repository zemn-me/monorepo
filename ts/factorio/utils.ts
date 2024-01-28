import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { groupMapList } from '#root/ts/iter/map.js';

function itemsNeeded(bp: Blueprint): Pick<Blueprint, 'entities' | 'tiles'> {
	const entities = groupMapList(bp.entities)(e => e.name);
	const tiles = groupMapList(bp.tiles)(tile => tile.name);
}
