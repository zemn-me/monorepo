import type { JournalAudioUpload } from '#root/project/me/zemn/hook/useZemnMeApi.js';

export interface LocalRecording {
	readonly id: string;
	readonly owner: string;
	readonly recordedAt: string;
	readonly timeZone: string;
	readonly contentType: JournalAudioUpload['contentType'];
	readonly name: string;
	readonly parts: readonly Blob[];
	readonly state: 'recording' | 'queued' | 'uploaded';
	readonly remoteEntryID?: string;
	readonly recordingStartedAt?: string;
	readonly uploadedAt?: number;
}

const databaseName = 'zemn-me-journal-recordings';
const storeName = 'recordings';

function openRecordings(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		let blocked = false;
		const request = indexedDB.open(databaseName, 1);
		request.onupgradeneeded = () => {
			const store = request.result.createObjectStore(storeName, {
				keyPath: 'id',
			});
			store.createIndex('owner', 'owner');
		};
		request.onsuccess = () => {
			if (blocked) request.result.close();
			else resolve(request.result);
		};
		request.onerror = () => reject(request.error);
		request.onblocked = () => {
			blocked = true;
			reject(new Error('Close other journal tabs and try again.'));
		};
	});
}

// Resolve writes only after the transaction commits, not when a request succeeds.
async function transaction<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const db = await openRecordings();
	try {
		return await new Promise<T>((resolve, reject) => {
			const tx = db.transaction(storeName, mode);
			const request = run(tx.objectStore(storeName));
			tx.oncomplete = () => resolve(request.result);
			tx.onabort = () =>
				reject(
					tx.error ??
						new Error('Could not save recording on this device.')
				);
			tx.onerror = () => reject(tx.error);
		});
	} finally {
		db.close();
	}
}

export function saveRecording(recording: LocalRecording): Promise<IDBValidKey> {
	return transaction('readwrite', store => store.put(recording));
}

export async function getRecording(
	owner: string,
	id: string
): Promise<LocalRecording | undefined> {
	const recording: LocalRecording | undefined = await transaction(
		'readonly',
		store => store.get(id)
	);
	return recording?.owner === owner ? recording : undefined;
}

export async function listRecordings(owner: string): Promise<LocalRecording[]> {
	const recordings: LocalRecording[] = await transaction('readonly', store =>
		store.index('owner').getAll(owner)
	);
	return recordings.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

export async function removeRecording(
	owner: string,
	id: string
): Promise<void> {
	if (await getRecording(owner, id))
		await transaction('readwrite', store => store.delete(id));
}

export function recordingBlob(recording: LocalRecording): Blob {
	return new Blob([...recording.parts], { type: recording.contentType });
}

export function recordingLock(owner: string): string {
	return `journal-recording:${owner}`;
}
