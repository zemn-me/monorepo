import { z } from 'zod/v4-mini';

const TagType = z.union([
	z.string(),
	z.boolean(),
	z.number(),
	z.record(z.string(), z.string()),
]);

/**
 * A dictionary of string to the four basic Lua types: string, boolean, number, table.
 *
 * Note that the API returns tags as a simple table, meaning any modifications to it will not propagate back to the game. Thus, to modify a set of tags, the whole table needs to be written back to the respective property.
 */
export const Tags = z.record(z.string(), TagType);
export type Tags = z.infer<typeof Tags>;
