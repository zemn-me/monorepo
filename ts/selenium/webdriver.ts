/**
 * @fileoverview wires up selenium webdriver
 */
import { statSync } from 'fs';
import * as Selenium from 'selenium-webdriver';
import Chrome from 'selenium-webdriver/chrome';

import { chromeDriverPath } from '#root/ts/bin/host/chromedriver/path.js';
import { chromiumPath } from '#root/ts/bin/host/chromium/path.js';

// ensure our deps actually exist

if (!statSync(chromeDriverPath).isFile()) throw new Error(
	`Can't find chrome driver at ${chromeDriverPath}.`
);

if (!statSync(chromiumPath).isFile()) throw new Error(
	`Can't find chrome at ${chromeDriverPath}.`
);

/**
 * @returns a Chrome ServiceBuilder injected with defaults.
 */
export const chromeService = (): Chrome.ServiceBuilder =>
	new Chrome.ServiceBuilder(chromeDriverPath);

/**
 * Returns a Selenium WebDriver set up with defaults.
 *
 */
export const Driver = (): Selenium.Builder =>
	new Selenium.Builder()
		.setChromeService(chromeService())
		.setChromeOptions(
			new Chrome.Options()
				.setChromeBinaryPath(chromiumPath)
				.addArguments('--disable-dev-shm-usage')
				.addArguments('--headless')
		);
