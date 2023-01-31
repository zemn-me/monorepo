/**
 * @fileoverview performs logging, following bazel conventions (
 * log only if a crash occurs).
 */

export interface Process {
	exitCode?: (typeof globalThis.process)['exitCode'];
	on(event: 'exit' | 'uncaughtException', handler: () => unknown): unknown;
}

export class Logger<C extends typeof console = typeof console> {
	deferredOperations: (() => unknown)[] = [];
	constructor(
		readonly console: Pick<
			typeof globalThis.console,
			'error' | 'log' | 'info'
		> = globalThis.console,
		readonly process: Process = globalThis.process
	) {
		process.on('exit', () => {
			if (process.exitCode !== undefined && process.exitCode !== 0) {
				this.cleanUp();
			}
		});

		process.on('uncaughtException', () => this.cleanUp());
	}

	cleanUp() {
		this.deferredOperations.forEach(op => op());
		this.deferredOperations = [];
	}

	log(...p: Parameters<C['log']>) {
		this.deferredOperations.push(() => this.console.log(...p));
	}

	error(...p: Parameters<C['error']>) {
		this.console.error(...p);
	}

	info(...p: Parameters<C['info']>) {
		this.deferredOperations.push(() => this.console.info(...p));
	}
}

const logger = new Logger();

export const log = logger.log.bind(logger);
export const error = logger.error.bind(logger);
export const info = logger.info.bind(logger);
