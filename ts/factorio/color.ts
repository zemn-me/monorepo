import { Float } from '#root/ts/factorio/float.js';

export interface Color {
	/**
	 * Red, 0 to 1.
	 */
	r: Float;
	/**
	 * Green, 0 to 1.
	 */
	g: Float;
	/**
	 * Blue, 0 to 1.
	 */
	b: Float;
	/**
	 * Transparency, 0 to 1.
	 */
	a: Float;
}
