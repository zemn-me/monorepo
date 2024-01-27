import { InfinityFilter } from '#root/ts/factorio/infinity_filter.js';

export interface InfinitySettings {
	remove_unfiltered_items: boolean;
	filters: InfinityFilter;
}
