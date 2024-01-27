import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintBook } from '#root/ts/factorio/blueprint_book.js';

interface BlueprintKey {
	blueprint: Blueprint;
}
interface BlueprintBookKey {
	'blueprint-book': BlueprintBook;
}

export type BlueprintWrapper = BlueprintKey | BlueprintBookKey;
