import JSZip from 'jszip';
import initSqlJs, { type SqlJsStatic } from 'sql.js';

export interface ParsedAnkiCard {
	readonly audio: ParsedAnkiMedia | null;
	readonly answer: string;
	readonly midi: string;
}

export interface ParsedAnkiMedia {
	readonly bytes: Uint8Array;
	readonly fileName: string;
	readonly mimeType: string;
}

export interface ParsedAnkiDeck {
	readonly cards: readonly ParsedAnkiCard[];
}

export interface ParseAnkiPackageOptions {
	readonly locateSqlWasmFile?: (fileName: string) => string;
}

const textDecoder = new TextDecoder();
const sqlJsByWasmLocation = new Map<string, Promise<SqlJsStatic>>();

function loadSqlJs(options: ParseAnkiPackageOptions): Promise<SqlJsStatic> {
	const wasmLocation = options.locateSqlWasmFile?.('sql-wasm.wasm') ?? '';
	const existing = sqlJsByWasmLocation.get(wasmLocation);
	if (existing != null) {
		return existing;
	}

	const promise = initSqlJs(
		options.locateSqlWasmFile == null
			? undefined
			: { locateFile: options.locateSqlWasmFile }
	);
	sqlJsByWasmLocation.set(wasmLocation, promise);
	return promise;
}

function parseNotes(
	sqlJs: SqlJsStatic,
	collection: Uint8Array
): readonly string[][] {
	const database = new sqlJs.Database(collection);
	try {
		const [result] = database.exec('select flds from notes order by id');
		if (result == null) {
			return [];
		}

		return result.values.map(([fields]) => {
			if (typeof fields !== 'string') {
				throw new Error('invalid Anki note fields');
			}
			return fields.split('\x1f');
		});
	} finally {
		database.close();
	}
}

function audioFileNameFromField(field: string): string | null {
	return /\[sound:([^\]]+)\]/.exec(field)?.[1] ?? null;
}

function audioMimeTypeFromFileName(fileName: string): string {
	if (fileName.toLowerCase().endsWith('.wav')) {
		return 'audio/wav';
	}

	return 'application/octet-stream';
}

async function readZipBytes(zip: JSZip, path: string): Promise<Uint8Array> {
	const file = zip.file(path);
	if (file == null) {
		throw new Error(`missing Anki package file ${path}`);
	}
	return file.async('uint8array');
}

export async function parseAnkiPackage(
	buffer: ArrayBuffer,
	options: ParseAnkiPackageOptions = {}
): Promise<ParsedAnkiDeck> {
	const zip = await JSZip.loadAsync(buffer);
	const sqlJs = await loadSqlJs(options);
	const collection = await readZipBytes(zip, 'collection.anki2');
	if (collection == null) {
		throw new Error('missing Anki collection.anki2');
	}

	const media = JSON.parse(textDecoder.decode(await readZipBytes(zip, 'media'))) as Record<
		string,
		string
	>;
	const mediaByName = new Map<string, Uint8Array>();
	for (const [index, name] of Object.entries(media)) {
		mediaByName.set(name, await readZipBytes(zip, index));
	}
	const cards = parseNotes(sqlJs, collection).map(fields => {
		const audioFileName = audioFileNameFromField(fields[0] ?? '');
		const audioBytes =
			audioFileName == null ? undefined : mediaByName.get(audioFileName);

		return {
			audio:
				audioFileName == null || audioBytes == null
					? null
					: {
							bytes: audioBytes,
							fileName: audioFileName,
							mimeType: audioMimeTypeFromFileName(audioFileName),
						},
			answer: fields[1] ?? '',
			midi: fields[2] ?? '',
		};
	});

	return {
		cards,
	};
}
