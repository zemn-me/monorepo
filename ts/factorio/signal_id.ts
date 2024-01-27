export interface SignalID {
	type: 'item' | 'fluid' | 'virtual';
	/**
	 * Name of the item, fluid or virtual signal.
	 */
	name?: string;
}
