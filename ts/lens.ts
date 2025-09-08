export type Lens<S, A> = <R>(
        f: (
                get: (s: S) => A,
                set: (v: A, s: S) => S,
        ) => R,
) => R;

export function LensGet<S, A>(lens: Lens<S, A>) {
        return lens((get) => get);
}

export function LensSet<S, A>(lens: Lens<S, A>) {
        return lens((_, set) => set);
}

/**
 * An adaptor that does a no-op Promise so an unpromised lense result can
 * be used where a promise would be.
 */
export function lensPromise<S, A>(lens: Lens<S, A>): Lens<Promise<S>, Promise<A>> {
        return (f) =>
                lens((get, set) =>
                        f(
                                /** get */ async s => Promise.resolve(get(await s)),
                                /** set */ async (a, b) => Promise.resolve(set(await a, await b)),
                        ),
                );
}

export function pipeLens<A, B, C>(
        lensAB: Lens<A, B>,
        lensBC: Lens<B, C>,
): Lens<A, C> {
        return (f) =>
                lensAB((getAB, setAB) =>
                        lensBC((getBC, setBC) =>
                                f(
                                        // get: A => C
                                        (a: A) => getBC(getAB(a)),
                                        // set: (C, A) => A
                                        (c: C, a: A) => setAB(setBC(c, getAB(a)), a),
                                ),
                        ),
                );
}
