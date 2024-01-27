import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintBook } from '#root/ts/factorio/blueprint_book.js';
import { JSONObject } from '#root/ts/json.js';

interface BlueprintKey extends JSONObject {
	blueprint: Blueprint;
}
interface BlueprintBookKey extends JSONObject {
	'blueprint-book': BlueprintBook;
}

export type BlueprintWrapper = BlueprintKey | BlueprintBookKey;
