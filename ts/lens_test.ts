import { describe, expect, it } from '@jest/globals';

import { Lens, LensGet, lensPromise, LensSet, pipeLens } from '#root/ts/lens.js';


describe('lens utilities', () => {
        type Box = { value: number };
        const boxLens: Lens<Box, number> = f =>
                f(
                        (box: Box) => box.value,
                        (value: number, box: Box) => ({ ...box, value }),
                );

        it('LensGet retrieves the getter part of a lens', () => {
                const get = LensGet(boxLens);
                const result = get({ value: 42 });

                expect(result).toBe(42);
        });

        it('LensSet retrieves the setter part of a lens', () => {
                const set = LensSet(boxLens);
                const original: Box = { value: 10 };
                const updated = set(55, original);

                expect(updated).toEqual({ value: 55 });
                expect(updated).not.toBe(original);
                expect(original).toEqual({ value: 10 });
        });

        it('lensPromise lifts a lens into an async context', async () => {
                const asyncLens = lensPromise(boxLens);

                const asyncGet = LensGet(asyncLens);
                await expect(asyncGet(Promise.resolve({ value: 7 }))).resolves.toBe(7);

                const asyncSet = LensSet(asyncLens);
                await expect(
                        asyncSet(Promise.resolve(99), Promise.resolve({ value: 1 })),
                ).resolves.toEqual({ value: 99 });
        });

        it('pipeLens composes two lenses into a nested lens', () => {
                type Inner = { value: number; label: string };
                type Outer = { inner: Inner; flag: boolean };

                const outerLens: Lens<Outer, Inner> = f =>
                        f(
                                (outer: Outer) => outer.inner,
                                (inner: Inner, outer: Outer) => ({ ...outer, inner }),
                        );

                const innerLens: Lens<Inner, number> = f =>
                        f(
                                (inner: Inner) => inner.value,
                                (value: number, inner: Inner) => ({ ...inner, value }),
                        );

                const composed = pipeLens(outerLens, innerLens);

                const get = LensGet(composed);
                const state: Outer = {
                        inner: { value: 13, label: 'thirteen' },
                        flag: true,
                };

                expect(get(state)).toBe(13);

                const set = LensSet(composed);
                const updated = set(21, state);

                expect(updated).toEqual({
                        inner: { value: 21, label: 'thirteen' },
                        flag: true,
                });
                expect(updated).not.toBe(state);
                expect(updated.inner).not.toBe(state.inner);
                expect(state.inner.value).toBe(13);
        });
});
