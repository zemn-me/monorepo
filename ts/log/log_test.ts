import * as log from '#monorepo/ts/log/index.js';

class MockConsole
	implements Pick<typeof window.console, 'error' | 'log' | 'info'>
{
	logOutput: Parameters<typeof console.log>[] = [];
	log(...p: Parameters<typeof console.log>) {
		this.logOutput.push(p);
	}

	errorOutput: Parameters<typeof console.error>[] = [];
	error(...p: Parameters<typeof console.error>) {
		this.errorOutput.push(p);
	}

	infoOutput: Parameters<typeof console.info>[] = [];
	info(...p: Parameters<typeof console.info>) {
		this.infoOutput.push(p);
	}
}

describe('MockConsole', () => {
	it('should log stuff', () => {
		const c = new MockConsole();

		c.log('ok');

		expect(c.logOutput).toEqual([['ok']]);

		c.error('ok?');
		expect(c.errorOutput).toEqual([['ok?']]);

		c.info('ok!');

		expect(c.infoOutput).toEqual([['ok!']]);
	});
});

class MockProcess implements log.Process {
	exitCode: undefined | number = undefined;
	eventHandlers = new Map<'exit' | 'uncaughtException', (() => unknown)[]>();
	on(event: 'exit' | 'uncaughtException', handler: () => unknown) {
		this.eventHandlers.set(
			event,
			(this.eventHandlers.get(event) ?? []).concat(handler)
		);
	}

	trigger(event: 'exit' | 'uncaughtException') {
		this.eventHandlers.get(event)?.forEach(e => e());
	}
}

describe('MockProcess', () => {
	it('should fire exit', () => {
		const p = new MockProcess();
		let resp = false;
		p.on('exit', () => (resp = true));
		p.trigger('exit');

		expect(resp).toEqual(true);
	});

	it('should not fire exit', () => {
		const p = new MockProcess();
		let resp = false;
		p.on('exit', () => (resp = true));

		expect(resp).toEqual(false);
	});
});

describe('log', () => {
	it('should only log errors if no failure occurred', () => {
		const process = new MockProcess();
		const console = new MockConsole();
		const logger = new log.Logger(console, process);

		logger.log('something happened!');
		logger.error('something failed!');
		logger.info('some information!');

		process.trigger('exit');

		expect(console.errorOutput).toEqual([['something failed!']]);
		expect(console.infoOutput).toEqual([]);
		expect(console.logOutput).toEqual([]);
	});

	it('should log everything if the process exited with a non-zero exit code', () => {
		const process = new MockProcess();
		const console = new MockConsole();
		const logger = new log.Logger(console, process);

		logger.log('something happened!');
		logger.error('something failed!');
		logger.info('some information!');

		process.exitCode = 1;

		process.trigger('exit');

		expect(console.errorOutput).toEqual([['something failed!']]);
		expect(console.infoOutput).toEqual([['some information!']]);
		expect(console.logOutput).toEqual([['something happened!']]);
	});

	it('should log everything if the process threw an uncaught error', () => {
		const process = new MockProcess();
		const console = new MockConsole();
		const logger = new log.Logger(console, process);

		logger.log('something happened!');
		logger.error('something failed!');
		logger.info('some information!');

		process.trigger('uncaughtException');

		expect(console.errorOutput).toEqual([['something failed!']]);
		expect(console.infoOutput).toEqual([['some information!']]);
		expect(console.logOutput).toEqual([['something happened!']]);
	});
});
