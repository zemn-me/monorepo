export const fromEntries: typeof Object.fromEntries =
    Object.fromEntries ??
        (<T extends any = any>(entries: Iterable<readonly [PropertyKey, T]>) => {
            const o: any = {};   
            for (const [k, v] of entries) o[k] = v;
            return o;
        })

