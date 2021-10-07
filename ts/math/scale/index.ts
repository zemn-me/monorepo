/**
 * Scale contains utility functions for converting a linearly-sized
 * self-sized path generator to one that can be rendered at specified size.
 * @packageDocumentation
 */

import { SVGAttributes } from 'react';

/**
 * A scalable is a generator for an svg Path element.
 */
export interface Scalable<cfg> {
	path(this: Scalable<cfg>, cfg: cfg): string;
	size(this: Scalable<cfg>, cfg: cfg): [number, number];
	props?: (
		this: Scalable<cfg>,
		cfg: cfg
	) => React.SVGAttributes<SVGPathElement>;
}

/**
 * extract all values of T
 */
type ValueOf<T> = T[keyof T];

/**
 * Extract properties of T that extend T2
 */
type Filter<T, T2> = Pick<
	T,
	ValueOf<{
		[K in keyof T]: T[K] extends T2 ? K : never;
	}>
>;

export class Generator<cfg>
	implements Scalable<cfg & { width: number; height: number }>
{
	scalable: Scalable<cfg>;
	keys: (keyof Filter<cfg, number>)[];
	props: Scalable<cfg & { width: number; height: number }>['props'];
	constructor(s: Scalable<cfg>, ...keys: (keyof Filter<cfg, number>)[]) {
		this.scalable = s;
		this.keys = keys;
		if (this.scalable.props) this.props = this._props;
	}

	scaleFactor(cfg: cfg & { width: number; height: number }): number {
		const [w, h] = this.scalable.size(cfg);
		const { width: tWidth, height: tHeight } = cfg;

		return scaleFactor(w, h, tWidth, tHeight);
	}

	scaledConfig(cfg: cfg & { width: number; height: number }): cfg & {
		width: number;
		height: number;
	} {
		const k = this.scaleFactor(cfg);

		const copy = { ...cfg };

		for (const key of this.keys) (copy[key] as unknown as number) *= k;
		return copy;
	}

	path(cfg: cfg & { width: number; height: number }): string {
		return this.scalable.path(this.scaledConfig(cfg));
	}

	size(cfg: cfg & { width: number; height: number }): [number, number] {
		return this.scalable.size(this.scaledConfig(cfg));
	}

	private _props(
		cfg: cfg & { width: number; height: number }
	): SVGAttributes<SVGPathElement> {
		if (!this.scalable.props) throw new Error();
		return this.scalable.props(this.scaledConfig(cfg));
	}
}

export const Scale = <cfg>(
	s: Scalable<cfg>,
	...keys: (keyof Filter<cfg, number>)[]
): Generator<cfg> => new Generator(s, ...keys);

const scaleFactor = (
	width: number,
	height: number,
	targetWidth: number,
	targetHeight: number
): number =>
	/*
        width * k < targetWidth
        height * k < targetHeight

        at least one:
        width * k = targetWidth (or)
        height * k = targetHeight

        for width * k = targetWidth
        k1 = targetWidth / width
        let u be utility
        u1 = height * k1 - targetHeight

        for height * k = targetHeight
        k2 = targetHeight / height
        u2 = width * k2 - targetWidth
    */
	{
		const [k1, k2] = [targetWidth / width, targetHeight / height];

		const [u1, u2] = [height * k1 - targetHeight, width * k2 - targetWidth];

		const scaleFactor = u1 < u2 ? k1 : k2;

		return scaleFactor;
	};
