import { describe, expect, it } from '@jest/globals';
import { Browser, until } from 'selenium-webdriver';

import { Driver } from '#root/ts/selenium/webdriver.js';

describe('selenium webdriver', () => {
	it('should load a data: uri', async () => {
		expect.assertions(0);
		const title = 'hello, world!';
		const driver = Driver().forBrowser(Browser.CHROME).build();

		try {
			await driver.get(`data:text/html,<title>${title}</title>`);
			await driver.wait(until.titleIs(title), 1000);
		} finally {
			await driver.quit();
		}
	});
});
