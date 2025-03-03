import { Lens } from "#root/ts/lens.js";

export function asyncStorageLens(k: string): Lens<Promise<Storage>, Promise<string | null>> {
	return [
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
	]
}

export function StorageLens(k: string): Lens<Storage, string | null> {
	return [
		/** get */ v => v.getItem(k),
		/** set */ (v, storage) => {
			if (v === null) {
				storage.removeItem(k)
			} else {
				storage.setItem(k, v);
			}
			return storage
		},
	]
}

