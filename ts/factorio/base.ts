import { Uint } from '#root/ts/factorio/uint';

export const OneBasedIndex = Uint.refine(v => v != 0, {
	message: '1-based index',
});
