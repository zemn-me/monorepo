// SPDX-License-Identifier: GPL-3.0-or-later
/* biome-ignore-all lint/suspicious/noConsole: Console output is the game's diagnostic log. */
import {
	createPeerTransport,
	type PeerTransport,
} from '#root/project/tiberian_sun/web/network.js';

export interface GameAssets {
	readonly engineJavaScript: string;
	readonly engineWasm: string;
	readonly engineData: string;
	readonly gameData: string;
}
export interface GameCampaign {
	readonly scenario: string;
	readonly files: Readonly<Record<string, string>>;
}

export interface DownloadProgress {
	readonly received: number;
	readonly total?: number;
}
export interface GameCallbacks {
	readonly progress: (progress: DownloadProgress | undefined) => void;
	readonly running: () => void;
	readonly error: (message: string) => void;
	readonly exit: () => void;
}

// Only the generated engine crosses this boundary. The launcher itself uses
// checked TS modules, and opaque filesystem backends stay inside Emscripten.
interface Engine {
	readonly FS: {
		mkdirTree(path: string): void;
		mount(
			backend: unknown,
			options: { autoPersist: boolean },
			path: string
		): void;
		syncfs(populate: boolean, callback: (error: unknown) => void): void;
		writeFile(
			path: string,
			data: string | Uint8Array,
			options?: { canOwn: boolean }
		): void;
		analyzePath(path: string): { exists: boolean };
		chdir(path: string): void;
	};
	readonly IDBFS: unknown;
	callMain(arguments_: string[]): void;
	_Web_Request_Stop(): void;
}
interface EngineOptions {
	readonly canvas: HTMLCanvasElement;
	readonly webNetwork: PeerTransport;
	readonly noInitialRun: true;
	readonly locateFile: (name: string) => string;
	readonly print: (message: string) => void;
	readonly printErr: (message: string) => void;
	readonly onAbort: (message: string) => void;
	readonly onExit: (code: number) => void;
}
type EngineFactory = (options: EngineOptions) => Promise<Engine>;

function isEngineModule(value: unknown): value is { default: EngineFactory } {
	return (
		typeof value === 'object' &&
		value !== null &&
		'default' in value &&
		typeof value.default === 'function'
	);
}

// SDL owns document-level listeners and audio. A replacement mount waits for
// the previous native shutdown before creating another engine in this document.
let previousExit: Promise<void> = Promise.resolve();

export function startGame(
	canvas: HTMLCanvasElement,
	assets: GameAssets,
	callbacks: GameCallbacks,
	signal: AbortSignal,
	campaign?: GameCampaign
): void {
	const preceding = previousExit;
	const { promise: exitComplete, resolve: stopped } =
		Promise.withResolvers<void>();
	previousExit = exitComplete;
	const lifetime = new AbortController();
	const webNetwork = createPeerTransport(lifetime.signal);
	let engine: Engine | undefined;
	let started = false;
	let exited = false;
	const fail = (message: string) => {
		if (!signal.aborted) callbacks.error(message);
	};
	const stop = () => {
		lifetime.abort();
		if (engine && started && !exited) engine._Web_Request_Stop();
	};
	signal.addEventListener('abort', stop, { once: true });
	window.addEventListener(
		'error',
		event => {
			console.error(event.error ?? event.message);
			fail(
				'The game stopped unexpectedly. See the browser console for details.'
			);
		},
		{ signal: lifetime.signal }
	);

	async function initialize() {
		try {
			await preceding;
			signal.throwIfAborted();
			const imported: unknown = await import(
				/* @vite-ignore */ assets.engineJavaScript
			);
			if (!isEngineModule(imported))
				throw new Error('Invalid engine module');
			const [loaded, data] = await Promise.all([
				imported.default({
					canvas,
					webNetwork,
					noInitialRun: true,
					locateFile: name =>
						name.endsWith('.wasm')
							? assets.engineWasm
							: assets.engineData,
					print: message => console.info(message),
					// Routine engine diagnostics also use stderr; it is not a severity signal.
					printErr: message => console.info(message),
					onAbort: message => {
						console.error('The game aborted:', message);
						fail(`The game stopped: ${message}.`);
					},
					onExit: code => {
						const cancelled =
							signal.aborted || lifetime.signal.aborted;
						exited = true;
						lifetime.abort();
						stopped();
						console.info('Tiberian Sun runtime stopped');
						if (cancelled) return;
						if (code !== 0) {
							console.error(
								`The game stopped (exit code ${code}).`
							);
							fail(`The game stopped (exit code ${code}).`);
						} else callbacks.exit();
					},
				}),
				downloadGame(
					assets.gameData,
					lifetime.signal,
					callbacks.progress
				),
			]);
			engine = loaded;
			signal.throwIfAborted();
			loaded.FS.mkdirTree('/game');
			loaded.FS.mkdirTree('/save');
			loaded.FS.mount(loaded.IDBFS, { autoPersist: true }, '/save');
			await new Promise<void>((resolve, reject) =>
				loaded.FS.syncfs(true, error =>
					error ? reject(error) : resolve()
				)
			);
			signal.throwIfAborted();
			importGame(loaded, data);
			if (!loaded.FS.analyzePath('/save/SUN.INI').exists) {
				loaded.FS.writeFile(
					'/save/SUN.INI',
					'[Video]\nScreenWidth=800\nScreenHeight=600\nWindowed=yes\n[Options]\nVideoBackBuffer=no\n'
				);
			}
			if (campaign) {
				// Campaign files are ephemeral game data; saved games stay in IDBFS.
				for (const [name, contents] of Object.entries(campaign.files)) {
					if (!/^[A-Z0-9_]+\.INI$/.test(name))
						throw new Error('Invalid campaign filename');
					loaded.FS.writeFile('/game/' + name, contents);
				}
				if (!Object.hasOwn(campaign.files, campaign.scenario))
					throw new Error('Missing campaign scenario');
				loaded.FS.writeFile('/game/SPAWN.INI',
					`[Settings]\nIsSinglePlayer=yes\nScenario=${campaign.scenario}\nCampaignID=-1\nGameSpeed=2\n`);
			}
			loaded.FS.chdir('/game');
			started = true;
			callbacks.running();
			canvas.focus();
			loaded.callMain([
				'-DATADIR=/game',
				'-USERDIR=/save',
				'-WIN',
				'-XCC',
				...(campaign ? ['-SPAWN'] : []),
			]);
		} catch (error) {
			if (!signal.aborted) {
				console.error(error);
				fail(
					`Could not start the game: ${error instanceof Error ? error.message : String(error)}.`
				);
			}
			stop();
		} finally {
			if (!started) {
				lifetime.abort();
				stopped();
			}
		}
	}
	void initialize();
}

async function downloadGame(
	url: string,
	signal: AbortSignal,
	progress: GameCallbacks['progress']
): Promise<Uint8Array<ArrayBuffer>> {
	const response = await fetch(url, { signal });
	if (!response.ok)
		throw new Error(`Game download failed (${response.status})`);
	if (!response.body) throw new Error('Game download has no response body');
	const total = Number(response.headers.get('content-length'));
	progress({ received: 0, ...(total > 0 ? { total } : {}) });
	let received = 0;
	const measured = response.body.pipeThrough(
		new TransformStream<Uint8Array<ArrayBuffer>, BufferSource>({
			transform(chunk, controller) {
				received += chunk.byteLength;
				progress({ received, ...(total > 0 ? { total } : {}) });
				controller.enqueue(chunk);
			},
		})
	);
	const bytes = await new Response(
		measured.pipeThrough(new DecompressionStream('gzip'))
	).arrayBuffer();
	progress(undefined);
	return new Uint8Array(bytes);
}

function importGame(engine: Engine, data: Uint8Array<ArrayBuffer>): void {
	if (
		data.length < 12 ||
		new TextDecoder().decode(data.subarray(0, 8)) !== 'OPENTSD1'
	)
		throw new Error('Invalid game package');
	const length = new DataView(
		data.buffer,
		data.byteOffset,
		data.byteLength
	).getUint32(8, true);
	if (length > data.length - 12) throw new Error('Incomplete game package');
	const files: unknown = JSON.parse(
		new TextDecoder().decode(data.subarray(12, 12 + length))
	);
	if (!Array.isArray(files)) throw new Error('Invalid game manifest');
	let offset = 12 + length;
	const names = new Set<string>();
	for (const entry of files as unknown[]) {
		if (
			typeof entry !== 'object' ||
			entry === null ||
			!('name' in entry) ||
			typeof entry.name !== 'string' ||
			!('size' in entry) ||
			typeof entry.size !== 'number'
		)
			throw new Error('Invalid game file');
		const { name, size } = entry;
		if (
			!/^[A-Z0-9_]+\.(MIX|MAP)$/.test(name) ||
			/^(SCORES|MOVIES)/.test(name) ||
			names.has(name) ||
			!Number.isSafeInteger(size) ||
			size <= 0 ||
			size > data.length - offset
		)
			throw new Error('Invalid game file');
		names.add(name);
		engine.FS.writeFile(
			'/game/' + name,
			data.subarray(offset, offset + size),
			{ canOwn: true }
		);
		offset += size;
	}
	if (offset !== data.length || !names.has('TIBSUN.MIX'))
		throw new Error('Incomplete game package');
}
