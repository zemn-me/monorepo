import http from 'node:http';

import { runfiles } from '@bazel/runfiles';
import { Browser } from 'selenium-webdriver';
import handler from 'serve-handler';
import { Driver } from 'ts/selenium/webdriver';

const base = runfiles.resolveWorkspaceRelative('project/zemn.me/out');

describe('zemn.me website', () => {
	it('should load without errors', async () => {
		expect.assertions(2);
		const server = http
			.createServer((rq, rw) => {
				handler(rq, rw, { public: base });
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

			await expect(chrome.getTitle()).resolves.toContain('Zemnmez');

			await expect(
				chrome.manage().logs().get('browser')
			).resolves.toHaveLength(0);
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
});
