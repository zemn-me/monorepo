import { z } from 'zod';

import { OneBasedIndex } from '#root/ts/factorio/base';

export const EntityNumber = OneBasedIndex;

/**
 * Index of the entity, 1-based.
 */
export type EntityNumber = z.TypeOf<typeof EntityNumber>;
