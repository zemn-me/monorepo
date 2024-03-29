import http from 'node:http';
import Path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import glob from 'fast-glob';
import { Browser } from 'selenium-webdriver';
import handler from 'serve-handler';

import { Driver } from '#root/ts/selenium/webdriver.js';

const base = runfiles.resolveWorkspaceRelative('project/zemn.me/out');

describe('zemn.me website', () => {
	it('should load the main page without errors', async () => {
		expect.assertions(2);
		const server = http
			.createServer((rq, rw) => {
				void handler(rq, rw, { public: base });
			})
			.listen();
		const addressInfo = server.address();

		if (addressInfo == null || typeof addressInfo == 'string')
			throw new Error('Not AddressInfo');
		const chrome = Driver().forBrowser(Browser.CHROME).build();
		try {
			// implicitly wait up to 5 seconds to load.
			await chrome.manage().setTimeouts({ implicit: 5000 });

			await chrome.get(`http://localhost:${addressInfo.port}`);

			await expect(
				chrome.getTitle().then(t => t.toLowerCase())
			).resolves.toContain('zemnmez');

			await expect(
				chrome.manage().logs().get('browser')
			).resolves.toHaveLength(0);
		} finally {
			server.closeAllConnections();
			await Promise.all([
				chrome.close(),
				new Promise((ok, fail) =>
					server.close(err => (err === undefined ? ok : fail)(err))
				),
			]);
		}
	});

	it('should load all endpoints without errors', async () => {
		expect.assertions(1);
		const server = http
			.createServer((rq, rw) => {
				void handler(rq, rw, { public: base });
			})
			.listen();

		try {
			const addressInfo = server.address();

			if (addressInfo == null || typeof addressInfo == 'string')
				throw new Error('Not AddressInfo');

			const origin = `http://localhost:${addressInfo.port}`;
			await expect(
				Promise.all(
					(await glob(Path.join(base, '/**/*.html')))
						.map(path => Path.relative(base, path))
						.map(relPath =>
							// get endpoints from html files
							relPath.replace(/index.html|.html$/g, '')
						)
						.map(async endpoint => {
							const driver = Driver()
								.forBrowser(Browser.CHROME)
								.build();
							try {
								await driver
									.manage()
									.setTimeouts({ implicit: 5000 });
								await driver.get(`${origin}/${endpoint}`);
								// try to make the test less flakey by waiting for
								// one second.
								await new Promise<void>(ok =>
									setTimeout(() => ok(), 1000)
								);
								const logs = await driver
									.manage()
									.logs()
									.get('browser');
								const url = await driver.getCurrentUrl();
								// we probably redirected away by accident,
								// and we don't want to inherit their logs.
								if (new URL(url).origin !== origin) return [];

								return logs.length
									? logs.map(log => ({
											url,
											endpoint,
											log,
										}))
									: logs;
							} finally {
								await driver.close();
							}
						})
				).then(v => v.flat(1))
			).resolves.toHaveLength(1);
		} finally {
			await server.close();
		}
	});
});
