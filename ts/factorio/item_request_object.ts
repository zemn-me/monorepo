import { ItemCountType } from '#root/ts/factorio/item_count_type.js';

/**
 * 1 or more instances of key/value pairs. Key is the name of the item, string. Value is the amount of items to be requested,
 */
export type ItemRequestObject = [name: string, value: ItemCountType][];
