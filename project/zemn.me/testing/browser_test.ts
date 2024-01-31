import http from 'node:http';
import Path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import { glob } from 'fast-glob';
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

			await Promise.all([
				expect(
					chrome.getTitle().then(t => t.toLowerCase())
				).resolves.toContain('zemnmez'),

				expect(
					chrome.manage().logs().get('browser')
				).resolves.toHaveLength(0),
			]);
		} finally {
			console.info('finishing up...');
			server.closeAllConnections();
			await Promise.all([
				chrome.close(),
				new Promise((ok, fail) =>
					server.close(err => (err === undefined ? ok : fail)(err))
				),
			]);
			console.info('all done!');
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
			await expect(
				Promise.all(
					(await glob('base/**/*.html', {}))
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
								await driver.get(
									`http://localhost:${addressInfo.port}/${endpoint}`
								);
								return driver.manage().logs().get('browser');
							} finally {
								await driver.close();
							}
						})
				).then(v => v.flat(1))
			).resolves.toHaveLength(0);
		} finally {
			await server.close();
		}
	});
});
