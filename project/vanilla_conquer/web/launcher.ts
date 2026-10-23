// SPDX-License-Identifier: GPL-3.0-or-later
/* biome-ignore-all lint/suspicious/noConsole: Console output is the game's diagnostic log. */
import { trackMouseHover } from '#root/ts/pointer/hover.js';

export interface GameAssets {
	readonly engineJavaScript: string;
	readonly engineWasm: string;
	readonly game: 'ra' | 'td';
	readonly gameData: string;
	readonly cinematics?: Readonly<Record<string, string>>;
}
export interface DownloadProgress {
	readonly received: number;
	readonly total?: number;
}
export type CinematicStatus =
	| {
			readonly kind: 'loading';
			readonly progress?: DownloadProgress;
			readonly skip: () => void;
	  }
	| {
			readonly kind: 'error';
			readonly retry: () => void;
			readonly skip: () => void;
	  };

export interface GameCallbacks {
	readonly progress: (progress: DownloadProgress | undefined) => void;
	readonly ready: (start: () => void) => void;
	readonly cinematic: (status: CinematicStatus | undefined) => void;
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
		unlink(path: string): void;
	};
	readonly IDBFS: unknown;
	callMain(arguments_: string[]): void;
	webStop: boolean;
	webLoadMovie?: (name: string) => Promise<number>;
	webReleaseMovie?: (name: string) => void;
}
interface EngineOptions {
	readonly canvas: HTMLCanvasElement;
	readonly webHasMouseHover: () => boolean;
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
	signal: AbortSignal
): void {
	const preceding = previousExit;
	const { promise: exitComplete, resolve: stopped } =
		Promise.withResolvers<void>();
	previousExit = exitComplete;
	const lifetime = new AbortController();
	// Right-click belongs to the game's map controls while this canvas is active.
	canvas.addEventListener('contextmenu', event => event.preventDefault(), {
		signal: lifetime.signal,
	});
	const webHasMouseHover = trackMouseHover(canvas, lifetime.signal);
	let engine: Engine | undefined;
	let started = false;
	let exited = false;
	const fail = (message: string) => {
		if (!signal.aborted) callbacks.error(message);
	};
	const stop = () => {
		lifetime.abort();
		if (engine && started && !exited) engine.webStop = true;
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
					webHasMouseHover,
					noInitialRun: true,
					locateFile: () => assets.engineWasm,
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
						console.info('Vanilla Conquer runtime stopped');
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
			const save = `/saves/${assets.game}`;
			loaded.FS.mkdirTree(save);
			loaded.FS.mount(loaded.IDBFS, { autoPersist: true }, save);
			await new Promise<void>((resolve, reject) =>
				loaded.FS.syncfs(true, error =>
					error ? reject(error) : resolve()
				)
			);
			signal.throwIfAborted();
			importGame(loaded, data, assets.game);
			const ini = assets.game === 'ra' ? 'redalert.ini' : 'conquer.ini';
			loaded.FS.writeFile(
				`/game/${ini}`,
				`[Paths]\nDataPath=/game\nUserPath=${save}\n`
			);
			if (!loaded.FS.analyzePath(`${save}/${ini}`).exists) {
				loaded.FS.writeFile(
					`${save}/${ini}`,
					'[Mouse]\nRawInput=no\n[Video]\nWindowed=yes\nHardwareCursor=no\nFrameLimit=60\n[Intro]\nPlayIntro=no\n'
				);
			}
			loaded.FS.chdir('/game');
			// Availability checks also decide whether saved missions offer a video
			// briefing. Empty markers advertise catalog entries without loading data.
			for (const name of Object.keys(assets.cinematics ?? {})) {
				loaded.FS.writeFile(`/game/${name}.VQA`, new Uint8Array());
			}
			const removeMovie = (name: string) => {
				for (const extension of ['VQA', 'VQP']) {
					const path = `/game/${name.toUpperCase()}.${extension}`;
					if (loaded.FS.analyzePath(path).exists)
						loaded.FS.unlink(path);
				}
			};
			loaded.webReleaseMovie = name => {
				removeMovie(name);
				// Native mission flow checks availability after playback to choose its
				// text fallback. Keep a zero-byte marker; playback always loads first.
				loaded.FS.writeFile(
					`/game/${name.toUpperCase()}.VQA`,
					new Uint8Array()
				);
			};
			loaded.webLoadMovie = async requested => {
				const name = requested.toUpperCase();
				const url = assets.cinematics?.[name];
				if (!url || lifetime.signal.aborted) return 0;
				const request = new AbortController();
				const skip = () => request.abort();
				lifetime.signal.addEventListener('abort', skip, { once: true });
				try {
					while (!request.signal.aborted) {
						try {
							callbacks.cinematic({ kind: 'loading', skip });
							const movie = await downloadGame(
								url,
								request.signal,
								progress => {
									if (!request.signal.aborted)
										callbacks.cinematic({
											kind: 'loading',
											progress,
											skip,
										});
								}
							);
							const names = importFiles(
								loaded,
								movie,
								new RegExp(`^${name}\\.(VQA|VQP)$`)
							);
							if (!names.has(`${name}.VQA`))
								throw new Error('Incomplete cinematic');
							return 1;
						} catch {
							removeMovie(name);
							if (request.signal.aborted) return 0;
							await new Promise<void>(resolve => {
								const finish = () => {
									request.signal.removeEventListener(
										'abort',
										finish
									);
									resolve();
								};
								request.signal.addEventListener(
									'abort',
									finish,
									{ once: true }
								);
								callbacks.cinematic({
									kind: 'error',
									retry: finish,
									skip,
								});
							});
						}
					}
					return 0;
				} finally {
					lifetime.signal.removeEventListener('abort', skip);
					if (!lifetime.signal.aborted) {
						callbacks.cinematic(undefined);
						canvas.focus();
					}
				}
			};
			if (assets.game === 'ra') {
				// Start the intro from a user gesture so browser audio can play.
				await new Promise<void>((resolve, reject) => {
					lifetime.signal.addEventListener(
						'abort',
						() => reject(lifetime.signal.reason),
						{ once: true }
					);
					callbacks.ready(resolve);
				});
				signal.throwIfAborted();
			}
			started = true;
			callbacks.running();
			canvas.focus();
			loaded.callMain([]);
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
	const response = await fetch(url, { signal, cache: 'force-cache' });
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

function importGame(
	engine: Engine,
	data: Uint8Array<ArrayBuffer>,
	game: 'ra' | 'td'
): void {
	const names = importFiles(engine, data, /^[A-Z0-9_]+\.(MIX|MAP)$/);
	if (
		!(game === 'ra'
			? names.has('MAIN.MIX') && names.has('REDALERT.MIX')
			: names.has('CONQUER.MIX') && names.has('CCLOCAL.MIX'))
	)
		throw new Error('Incomplete game package');
}

function importFiles(
	engine: Engine,
	data: Uint8Array<ArrayBuffer>,
	allowed: RegExp
): Set<string> {
	if (
		data.length < 12 ||
		new TextDecoder().decode(data.subarray(0, 8)) !== 'VANILLD1'
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
			!allowed.test(name) ||
			/^SCORES/.test(name) ||
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
	if (offset !== data.length) throw new Error('Incomplete game package');
	return names;
}
