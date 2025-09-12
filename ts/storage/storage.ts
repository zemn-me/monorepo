import { Lens, LensGet } from "#root/ts/lens.js";
import { None, Option, Some, unwrap } from "#root/ts/option/types.js";

export function asyncStorageLens(k: string): Lens<Promise<Storage>, Promise<string | null>> {
        return f => f(
                /** get */async v => (await v).getItem(k),
                /** set */async (pv, storage) => {
                        const v = await pv;
                        if (v === null) {
                                (await storage).removeItem(k)
                        } else {
                                (await storage).setItem(k, v);
                        }
                        return storage
                },
        )
}

/**
 * Bulies the lens {@link l} into giving us the key it asks for in the storage.
 * Note that this will fail if {@link l} requests a different key sometimes.
 *
 * This is somewhat of an unsafe function. But a friendly unsafe one.
 */
export function storagelensKey(l: Lens<Storage, unknown>): string {
	let key: Option<string> = None;
	try {
		LensGet(l)({
			getItem(K) { key = Some(K); return null }
		} as Storage)
	} catch {
		key = None;
	}

	return unwrap(key as Option<string>);
}
/**
 * Bulies the lens {@link l} into giving us the key it asks for in the storage.
 * Note that this will fail if {@link l} requests a different key sometimes.
 *
 * This is somewhat of an unsafe function. But a friendly unsafe one.
 *
 * This may need to return a Promise<string>, but that is too stressful
 * for me right now.
 */
export async function asyncStorageLensKey<T>(l: Lens<Promise<Storage>, Promise<T>>): Promise<string> {
	let key: Option<string> = None;
	try {
		await LensGet(l)((Promise.resolve({
			getItem(K) { key = Some(K); return null }
		} as Storage)))
	} catch {
		key = None;
	}

	return unwrap(key as Option<string>);
}

export function StorageLens(k: string): Lens<Storage, string | null> {
        return f => f(
                /** get */ v => v.getItem(k),
                /** set */ (v, storage) => {
                        if (v === null) {
                                storage.removeItem(k)
                        } else {
                                storage.setItem(k, v);
                        }
                        return storage
                },
        )
}

