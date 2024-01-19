/**
 * @fileoverview wires up selenium webdriver
 */
import * as Selenium from 'selenium-webdriver';
import Chrome from 'selenium-webdriver/chrome';
import { chromeDriverPath } from 'ts/bin/host/chromedriver/path';
import { chromiumPath } from 'ts/bin/host/chromium/path';

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
