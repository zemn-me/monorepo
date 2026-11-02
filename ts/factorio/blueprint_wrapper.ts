import { z } from 'zod';

import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintBook } from '#root/ts/factorio/blueprint_book.js';

const BlueprintKey = z.strictObject({
	blueprint: Blueprint,
});

const BlueprintBookKey = z.strictObject({
	blueprint_book: BlueprintBook,
});

export const BlueprintWrapper = z.union([BlueprintKey, BlueprintBookKey]);
export type BlueprintWrapper = z.TypeOf<typeof BlueprintWrapper>;
